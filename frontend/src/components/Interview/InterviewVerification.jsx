import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Paper,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchData } from "../../AppUtils/dataAPI";
import {
    createFaceDescriptorFromSource,
    isVerificationMediaClear
} from "../webrtc/faceIdentityUtils";

const ACCEPT_BY_MODE = {
    photo: "image/*",
    video: "video/*"
};

const STATUS_COLOR = {
    Completed: "success",
    Pending: "warning",
    Rejected: "error",
    NotRequired: "info"
};

const readImageFromFile = (file) =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
        img.src = url;
    });

const seekVideo = (video, seconds) =>
    new Promise((resolve, reject) => {
        const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
        const onSeeked = () => { cleanup(); resolve(); };
        const onError = (err) => { cleanup(); reject(err || new Error("Video seek failed")); };
        const cleanup = () => {
            video.removeEventListener("seeked", onSeeked);
            video.removeEventListener("error", onError);
        };
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);
        try { video.currentTime = safeSeconds; } catch (err) { cleanup(); reject(err); }
    });

const loadVideoFromFile = (file) =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => resolve({ video, url });
        video.onerror = (err) => { URL.revokeObjectURL(url); reject(err || new Error("Failed to load video")); };
        video.src = url;
    });

function clampTime(seconds, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.min(Math.max(0, seconds), Math.max(duration - 0.05, 0));
}

export default function InterviewVerification() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const candidateId = searchParams.get("cid") || "";
    const jobId = searchParams.get("jid") || "";
    const interviewScheduleId = searchParams.get("sid") || "";
    const initialInterviewToken = searchParams.get("token") || "";

    const [loadingStatus, setLoadingStatus] = useState(true);
    const [statusError, setStatusError] = useState("");
    const [verification, setVerification] = useState(null);
    const [mode, setMode] = useState("photo");
    const [mediaFile, setMediaFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [liveCameraOn, setLiveCameraOn] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [submitError, setSubmitError] = useState("");
    const [submitSuccess, setSubmitSuccess] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [interviewAccessToken, setInterviewAccessToken] = useState(initialInterviewToken);

    const liveVideoRef = useRef(null);
    const liveStreamRef = useRef(null);
    const fileInputRef = useRef(null);

    const verificationStatus = verification?.status || "Pending";
    const verificationComplete = verificationStatus === "Completed";

    const interviewUrl = useMemo(() => {
        if (!candidateId || !jobId) return "";
        const params = new URLSearchParams({ cid: candidateId, jid: jobId });
        if (interviewAccessToken) params.set("token", interviewAccessToken);
        if (interviewScheduleId) params.set("sid", interviewScheduleId);
        return `/webrtcai/?${params.toString()}`;
    }, [candidateId, interviewAccessToken, jobId, interviewScheduleId]);

    const clearPreview = useCallback(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
    }, [previewUrl]);

    const stopLiveCamera = useCallback(() => {
        setLiveCameraOn(false);
        if (liveStreamRef.current) {
            liveStreamRef.current.getTracks().forEach((track) => { try { track.stop(); } catch { /* ignore */ } });
            liveStreamRef.current = null;
        }
        if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    }, []);

    const loadVerificationStatus = useCallback(async () => {
        if (!candidateId || !jobId) {
            setStatusError("Verification link is missing candidate/job details.");
            setLoadingStatus(false);
            return;
        }
        try {
            setLoadingStatus(true);
            setStatusError("");
            const qs = new URLSearchParams({ candidateId, jobId });
            if (interviewScheduleId) qs.set("interviewScheduleId", interviewScheduleId);
            const res = await fetchData(`/api/interviewschedules/verification/status?${qs.toString()}`);
            if (res?.interviewAccessToken) setInterviewAccessToken(res.interviewAccessToken);
            setVerification(res?.verification ? { ...res.verification, scheduleId: res.scheduleId || null } : null);
        } catch (err) {
            setStatusError(err?.error || err?.message || "Failed to load verification status.");
        } finally {
            setLoadingStatus(false);
        }
    }, [candidateId, jobId, interviewScheduleId]);

    useEffect(() => { void loadVerificationStatus(); }, [loadVerificationStatus]);
    useEffect(() => () => { clearPreview(); stopLiveCamera(); }, [clearPreview, stopLiveCamera]);

    const openFilePicker = useCallback(() => {
        if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); }
    }, []);

    const handleModeChange = useCallback((_, nextMode) => {
        if (!nextMode) return;
        setMode(nextMode);
        setMediaFile(null);
        setAnalysis(null);
        setSubmitError("");
        setSubmitSuccess("");
        clearPreview();
        if (nextMode !== "live_photo") stopLiveCamera();
    }, [clearPreview, stopLiveCamera]);

    const handleFileSelected = useCallback((event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        setSubmitError("");
        setSubmitSuccess("");
        setAnalysis(null);
        setMediaFile(file);
        clearPreview();
        setPreviewUrl(URL.createObjectURL(file));
    }, [clearPreview]);

    const startLiveCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
            liveStreamRef.current = stream;
            if (liveVideoRef.current) { liveVideoRef.current.srcObject = stream; await liveVideoRef.current.play(); }
            setLiveCameraOn(true);
        } catch (err) {
            setSubmitError("Unable to access camera. Please allow camera permission and try again.");
        }
    }, []);

    const captureLivePhoto = useCallback(async () => {
        const videoEl = liveVideoRef.current;
        if (!videoEl || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) {
            setSubmitError("Camera preview is not ready. Please wait and try again.");
            return;
        }
        try {
            const canvas = document.createElement("canvas");
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) { setSubmitError("Unable to capture from camera."); return; }
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
            if (!blob) { setSubmitError("Unable to capture image. Please try again."); return; }
            const file = new File([blob], `live-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
            setMediaFile(file);
            clearPreview();
            setPreviewUrl(URL.createObjectURL(file));
            setAnalysis(null);
            setSubmitError("");
            setSubmitSuccess("");
        } catch (err) {
            setSubmitError("Failed to capture live photo. Please try again.");
        }
    }, [clearPreview]);

    const analyzeVideoFile = useCallback(async (file) => {
        const { video, url } = await loadVideoFromFile(file);
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const checkpoints = duration > 0 ? [0.15, 0.32, 0.5, 0.68, 0.82].map((r) => duration * r) : [0];
        let bestResult = null;
        for (const second of checkpoints) {
            try {
                await seekVideo(video, clampTime(second, duration));
                const result = await createFaceDescriptorFromSource(video);
                if (result?.ok && (!bestResult || (result.qualityScore || 0) > (bestResult.qualityScore || 0))) bestResult = result;
            } catch { /* ignore */ }
        }
        URL.revokeObjectURL(url);
        return bestResult;
    }, []);

    const analyzeMedia = useCallback(async () => {
        if (!mediaFile) { setSubmitError("Please select or capture media first."); return null; }
        setProcessing(true);
        setSubmitError("");
        setSubmitSuccess("");
        setAnalysis(null);
        try {
            let result = null;
            if (mode === "video") {
                result = await analyzeVideoFile(mediaFile);
            } else {
                const imageEl = await readImageFromFile(mediaFile);
                result = await createFaceDescriptorFromSource(imageEl);
            }
            if (!result) { setSubmitError("Unable to analyze media. Please try a different file."); return null; }
            setAnalysis(result);
            if (!result.ok) {
                setSubmitError(result.faceCount === 0 ? "No clear face detected. Please upload/capture again." : "Multiple faces detected. Ensure only one person is visible.");
                return null;
            }
            if (!isVerificationMediaClear({ qualityScore: result.qualityScore, clarityScore: result.clarityScore })) {
                setSubmitError(`Media is not clear enough (${result.clarityReason || "low clarity"}). Please upload in better lighting.`);
                return null;
            }
            return result;
        } catch (err) {
            setSubmitError("Failed to analyze media. Please try again.");
            return null;
        } finally {
            setProcessing(false);
        }
    }, [analyzeVideoFile, mediaFile, mode]);

    const submitVerification = useCallback(async () => {
        const result = await analyzeMedia();
        if (!result) return;
        try {
            setSubmitting(true);
            setSubmitError("");
            const descriptor = Array.isArray(result.descriptor) ? result.descriptor : [];
            const payload = new FormData();
            payload.append("candidateId", candidateId);
            payload.append("jobId", jobId);
            payload.append("mediaType", mode);
            if (verification?.scheduleId) payload.append("interviewScheduleId", String(verification.scheduleId));
            payload.append("descriptor", JSON.stringify(descriptor));
            payload.append("qualityScore", String(result.qualityScore || 0));
            payload.append("clarityScore", String(result.clarityScore || 0));
            payload.append("clarityReason", result.clarityReason || "");
            payload.append("media", mediaFile, mediaFile?.name || "verification-media");
            const res = await fetchData("/api/interviewschedules/verification/submit", { method: "POST", body: payload });
            if (res?.interviewAccessToken) setInterviewAccessToken(res.interviewAccessToken);
            setVerification(res?.verification ? { ...res.verification, scheduleId: res?.scheduleId || verification?.scheduleId || null } : null);
            setSubmitSuccess("Verification completed successfully.");
        } catch (err) {
            setSubmitError(err?.error || err?.message || "Failed to submit verification.");
        } finally {
            setSubmitting(false);
        }
    }, [analyzeMedia, candidateId, jobId, mediaFile, mode, verification]);

    const canSubmit = !loadingStatus && !verificationComplete && !!mediaFile && !processing && !submitting;

    return (
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
            <Paper elevation={3} sx={{ width: "100%", maxWidth: 760, borderRadius: 3, p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        Interview Identity Verification
                    </Typography>
                    <Chip size="small" label={verificationStatus} color={STATUS_COLOR[verificationStatus] || "default"} variant="outlined" />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                    Upload a clear photo/video or capture a live photo. Verification must be completed before interview start.
                </Typography>

                {loadingStatus && (
                    <Stack direction="row" alignItems="center" gap={1}>
                        <CircularProgress size={18} />
                        <Typography variant="body2">Loading verification status...</Typography>
                    </Stack>
                )}

                {statusError && <Alert severity="error">{statusError}</Alert>}
                {submitError && <Alert severity="error">{submitError}</Alert>}
                {submitSuccess && <Alert severity="success">{submitSuccess}</Alert>}

                {!loadingStatus && !statusError && (
                    <>
                        {verificationComplete ? (
                            <Alert severity="success">
                                Verification completed. You can now proceed to the interview.
                            </Alert>
                        ) : (
                            <>
                                <ToggleButtonGroup color="primary" value={mode} exclusive onChange={handleModeChange} size="small">
                                    <ToggleButton value="photo">Upload Photo</ToggleButton>
                                    <ToggleButton value="video">Upload Video</ToggleButton>
                                    <ToggleButton value="live_photo">Live Capture</ToggleButton>
                                </ToggleButtonGroup>

                                {(mode === "photo" || mode === "video") && (
                                    <Stack direction="row" gap={1}>
                                        <Button variant="outlined" onClick={openFilePicker}>
                                            Select {mode === "photo" ? "Photo" : "Video"}
                                        </Button>
                                        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                                            {mediaFile ? mediaFile.name : "No file selected"}
                                        </Typography>
                                        <input ref={fileInputRef} type="file" accept={ACCEPT_BY_MODE[mode]} style={{ display: "none" }} onChange={handleFileSelected} />
                                    </Stack>
                                )}

                                {mode === "live_photo" && (
                                    <Stack direction="row" gap={1} flexWrap="wrap">
                                        {!liveCameraOn ? (
                                            <Button variant="outlined" onClick={startLiveCamera}>Start Camera</Button>
                                        ) : (
                                            <>
                                                <Button variant="contained" onClick={captureLivePhoto}>Capture Photo</Button>
                                                <Button variant="outlined" color="inherit" onClick={stopLiveCamera}>Stop Camera</Button>
                                            </>
                                        )}
                                    </Stack>
                                )}

                                {mode === "live_photo" && (
                                    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
                                        <video ref={liveVideoRef} autoPlay muted playsInline style={{ width: "100%", maxHeight: 360, objectFit: "cover" }} />
                                    </Box>
                                )}

                                {previewUrl && (
                                    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
                                        {mode === "video" ? (
                                            <video src={previewUrl} controls style={{ width: "100%", maxHeight: 360, objectFit: "contain" }} />
                                        ) : (
                                            <img src={previewUrl} alt="Verification preview" style={{ width: "100%", maxHeight: 360, objectFit: "contain" }} />
                                        )}
                                    </Box>
                                )}

                                {analysis && (
                                    <Stack direction="row" gap={1} flexWrap="wrap">
                                        <Chip size="small" label={`Faces: ${analysis.faceCount ?? 0}`} />
                                        <Chip size="small" label={`Quality: ${analysis.qualityScore ?? 0}`} />
                                        <Chip size="small" label={`Clarity: ${analysis.clarityScore ?? 0}`} />
                                        <Chip size="small" label={`Source: ${analysis.backend || "-"}`} />
                                    </Stack>
                                )}

                                {(processing || submitting) && (
                                    <Stack direction="row" alignItems="center" gap={1}>
                                        <CircularProgress size={18} />
                                        <Typography variant="body2">
                                            {processing ? "Analyzing media..." : "Submitting verification..."}
                                        </Typography>
                                    </Stack>
                                )}

                                <Stack direction="row" gap={1} flexWrap="wrap">
                                    <Button variant="contained" disabled={!canSubmit} onClick={submitVerification}>
                                        Submit Verification
                                    </Button>
                                    <Button variant="outlined" onClick={() => navigate(-1)}>Back</Button>
                                    {interviewUrl && (
                                        <Button variant="text" onClick={() => navigate(interviewUrl)}>Open Interview</Button>
                                    )}
                                </Stack>
                            </>
                        )}

                        {verificationComplete && (
                            <Stack direction="row" gap={1} flexWrap="wrap">
                                <Button variant="contained" disabled={!interviewUrl} onClick={() => navigate(interviewUrl)}>
                                    Continue to Interview
                                </Button>
                                <Button variant="outlined" onClick={loadVerificationStatus}>Refresh Status</Button>
                            </Stack>
                        )}
                    </>
                )}
            </Paper>
        </Box>
    );
}
