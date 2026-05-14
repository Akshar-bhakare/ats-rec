
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { fetchData, getCookie } from "../AppUtils/dataAPI";
// import talkingAvatar from "../assets/talking_A maya avatar.gif";
import "./WebRTC.css";
import { useMediaQuery } from "@mui/material";
import { useUiContextState } from "../contexts/UiContext";
import { useAuthContextState } from "../contexts/AuthContext";
import { defaultAntiCheatConfig, createInitialAntiCheatState, getAntiCheatMessageForReason, useTabAndWindowAntiCheat, useCameraTrackAntiCheat, useSinglePersonDetection, useMultipleVoiceDetection, useScreenshotAntiCheat, useClipboardBlocker } from "./webrtcAntiCheat";
import { alpha, useTheme } from "@mui/material/styles";
import WebRTCEndInterviewDialog from "./webrtc/WebRTCEndInterviewDialog";
import WebRTCInterviewPausedDialog from "./webrtc/WebRTCInterviewPausedDialog";
import WebRTCSystemCheckDialog from "./webrtc/WebRTCSystemCheckDialog";
import WebRTCConsentDialog from "./webrtc/WebRTCConsentDialog";
import WebRTCAIView from "./webrtc/WebRTCAIView";
import WebRTCHumanView from "./webrtc/WebRTCHumanView";
import WebRTCFaceMismatchDialog from "./webrtc/WebRTCFaceMismatchDialog";
import WebRTCReadingPassageDialog from "./webrtc/WebRTCReadingPassageDialog";
import { createFaceDescriptorFromSource, compareFaceDescriptors } from "./webrtc/faceIdentityUtils";

const CodingWebRTC = lazy(() => import("./codingRound/codingWebRTC"));

const SCRIPT_META_CACHE_TTL_MS = 3000;
const scriptMetaPromiseCache = new Map();

export default function WebRTC() {
    const videoRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const lastAudioUrlRef = useRef(null);
    const recordingStopTimeoutRef = useRef(null);
    const sessionRecordingStopTimeoutRef = useRef(null);
    const sessionRecordingUploadedRef = useRef(false);
    const recordingSessionIdRef = useRef(null);
    const recordingStartTimeLocalRef = useRef(0);
    const lastChunkEndTimeRef = useRef(0);

    const recordingChunkSeqRef = useRef(0);
    const recordingUploadQueueRef = useRef(Promise.resolve());
    const recordingChunkedEnabledRef = useRef(false);

    // Chunked upload tracking
    const chunkSeqNoRef = useRef(0);
    const chunkUploadActiveRef = useRef(false);
    const serverTimeOffsetRef = useRef(0); // Offset = ServerTime - LocalTime
    const trackStartMsRef = useRef(null); // The server-adjusted start time of the recording
    const hasSentStartMsRef = useRef(false); // Track if we have sent the start time to backend
    const [userRole, setUserRole] = useState(null); // 'candidate' or 'interviewer'

    const [authState] = useAuthContextState(); // Get auth state

    const [, setUiState] = useUiContextState();

    // full-session recorder (video + audio mix)
    const sessionRecorderRef = useRef(null);
    const sessionChunksRef = useRef([]);

    // audio mixing for mic + AI audio
    const audioContextRef = useRef(null);
    const mixDestRef = useRef(null);          // TX-only mix: local mic (sent via WebRTC, no remote audio to prevent echo)
    const recordingMixDestRef = useRef(null); // Recording mix: local mic + remote audio
    const mixedStreamRef = useRef(null);
    const userStreamRef = useRef(null);

    // composite canvas (local + all remote videos)
    const canvasRef = useRef(null);
    const canvasStreamRef = useRef(null);
    const canvasDrawIntervalRef = useRef(null);
    const transcriptRef = useRef(null);

    // hidden video elements and audio nodes for remote participants
    const remoteVideoElsRef = useRef({});
    const remoteAudioSourcesRef = useRef({});

    // keep track of original camera and screenshare tracks
    const originalVideoTrackRef = useRef(null);
    const screenShareTrackRef = useRef(null);
    const screenShareStreamRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const screenShareStoppingRef = useRef(false);
    const renegotiatingPeersRef = useRef({});
    const remoteCameraStreamsRef = useRef({});
    const remoteScreenStreamsRef = useRef({});
    const remoteScreenTrackIdsRef = useRef({});
    const remoteScreenSharingPeersRef = useRef(new Set());
    const promotedCameraStreamsRef = useRef({});

    // signaling + peers
    const signalingRef = useRef(null);
    const peersRef = useRef({}); // remotePeerId -> RTCPeerConnection
    const [remoteStreams, setRemoteStreams] = useState([]); // [{id, stream}]
    const [remoteScreenStreams, setRemoteScreenStreams] = useState([]); // [{id, stream, trackId}]
    const [remoteScreenSharingPeers, setRemoteScreenSharingPeers] = useState(() => new Set());
    const localPeerIdRef = useRef(
        `peer_${Math.random().toString(36).slice(2, 10)}`
    );

    const [isRecording, setRecording] = useState(false);
    const isRecordingRef = useRef(false);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const aiSpeakingRef = useRef(false);
    const [conversation, setConversation] = useState([]);
    const [roomSnapshot, setRoomSnapshot] = useState(null);
    const [peerNamesMap, setPeerNamesMap] = useState({}); // peerId -> display label
    const [humanChatOpen, setHumanChatOpen] = useState(false);
    const [humanChatDraft, setHumanChatDraft] = useState("");
    const [humanChatMessages, setHumanChatMessages] = useState([]);
    const [humanChatError, setHumanChatError] = useState("");
    const [showTranscript, setShowTranscript] = useState(false);
    const [mediaReady, setMediaReady] = useState(false);
    const [isInterviewPaused, setIsInterviewPaused] = useState(false);
    const [isSlowMode, setIsSlowMode] = useState(false);
    const [clickedAction, setClickedAction] = useState(null);
    const audioRef = useRef(null);
    const pendingAudioRef = useRef(null);
    const ttsStreamRef = useRef({
        mediaSource: null,
        sourceBuffer: null,
        queue: [],
        pendingEnd: false,
        objectUrl: null,
        mime: "audio/mpeg",
        active: false
    });
    const pendingAiResponseRef = useRef(null);
    const pendingAiFlushTimeoutRef = useRef(null);
    const ttsChunkCountRef = useRef(0);
    const sttWsRef = useRef(null);
    const sttAudioCtxRef = useRef(null);
    const sttProcessorRef = useRef(null);
    const sttSourceRef = useRef(null);
    const sttZeroGainRef = useRef(null);
    const sttTurnIdRef = useRef(null);
    const sttPendingUserTextRef = useRef("");
    const sttAudioChunksRef = useRef([]);
    const sttAudioContentTypeRef = useRef("audio/mpeg");
    const sttCaptureActiveRef = useRef(false);
    const sttSendAllowedRef = useRef(false);
    const isInterviewPausedRef = useRef(false);
    const slowModeRef = useRef(false);
    const systemCheckStreamRef = useRef(null);
    const systemCheckAudioCtxRef = useRef(null);
    const systemCheckSourceRef = useRef(null);
    const systemCheckAnalyserRef = useRef(null);
    const systemCheckRafRef = useRef(null);
    const systemCheckLastLevelUpdateRef = useRef(0);
    const systemCheckMicHitCountRef = useRef(0);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const [consentSubmitting, setConsentSubmitting] = useState(false);
    const [systemCheckPassed, setSystemCheckPassed] = useState(false);
    const [systemCheckRunning, setSystemCheckRunning] = useState(false);
    const [systemCheckAttempted, setSystemCheckAttempted] = useState(false);
    const [systemCheckError, setSystemCheckError] = useState("");
    const [systemCheckConsent, setSystemCheckConsent] = useState(false);
    const [systemCheckResults, setSystemCheckResults] = useState({
        browser: null,
        secure: null,
        devices: null,
        permissions: null,
        memory: null,
        tabMemory: null,
        cameraActive: null,
        micActive: null
    });
    const [systemCheckStream, setSystemCheckStream] = useState(null);
    const [systemCheckMicLevel, setSystemCheckMicLevel] = useState(0);
    const [systemCheckMicOk, setSystemCheckMicOk] = useState(false);
    const [systemCheckCameraOk, setSystemCheckCameraOk] = useState(false);
    const [isInterviewActive, setIsInterviewActive] = useState(false);
    const isInterviewActiveRef = useRef(false);
    const [startRecordingBusy, setStartRecordingBusy] = useState(false);
    const [startRecordingError, setStartRecordingError] = useState("");
    const interviewEndedRef = useRef(false);
    const endInProgressRef = useRef(false);
    const greetingPlayedRef = useRef(false);
    const silenceTimerRef = useRef(null);
    const silencePromptCountRef = useRef(0);
    const silenceWatchActiveRef = useRef(false);
    const silencePromptInFlightRef = useRef(false);

    // Meet-style control states
    const [isMicOn, setIsMicOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const candidateId = searchParams.get("cid") || null;
    const jobId = searchParams.get("jid") || null;
    const scheduleIdFromUrl = searchParams.get("sid") || null;
    const interviewerTypeFromUrl = searchParams.get("itype") || null;
    const accessToken = searchParams.get("token") || searchParams.get("t") || null;

    // shared roomId – every participant for this interview uses this
    const roomId =
        jobId && candidateId ? `${jobId}_${candidateId}` : "generic_room";

    // dialogs / evaluation
    const [confirmEndOpen, setConfirmEndOpen] = useState(false);
    // const [evaluationOpen, setEvaluationOpen] = useState(false);
    const [linkError, setLinkError] = useState(null);

    // Reading passage state
    const [readingPassageOpen, setReadingPassageOpen] = useState(false);
    const [readingPassageText, setReadingPassageText] = useState("");
    const [readingPassageDifficulty, setReadingPassageDifficulty] = useState("");
    const [readingPassageLoading, setReadingPassageLoading] = useState(false);
    const [readingPassageError, setReadingPassageError] = useState("");
    const [readingRecording, setReadingRecording] = useState(false);
    const [readingSubmitting, setReadingSubmitting] = useState(false);
    const readingRecorderRef = useRef(null);
    const readingChunksRef = useRef([]);

    // Face matching state
    const [faceMismatchOpen, setFaceMismatchOpen] = useState(false);
    const [faceMatchState, setFaceMatchState] = useState({ score: null, matched: true, checkedAt: null, reason: null, faceCount: null });
    const faceMatchCheckInFlightRef = useRef(false);
    const lastFaceMismatchEventAtRef = useRef(0);
    const lastFaceMatchPersistAtRef = useRef(0);

    // timer
    const [callTime, setCallTime] = useState(0);
    const timerRef = useRef(null);
    const [callLimitSeconds, setCallLimitSeconds] = useState(null);
    const autoEndTriggeredRef = useRef(false);
    const callStartAtRef = useRef(null);

    const [scriptMeta, setScriptMeta] = useState({
        technicalScript: "",
        candidateName: "",
        jobTitle: "",
        interviewerType: "AI",
        antiCheatConfig: defaultAntiCheatConfig,
        durationMinutes: null,
        accessEndsAt: null,
        roundType: "Speaking",
        interviewId: null,
        problem: null,
        testCases: [],
        identityVerification: { status: "NotRequired", required: false, referenceDescriptor: [], matchThresholdPercent: 70, mismatchCount: 0 },
        readingPassageEnabled: false,
    });

    const [localStream, setLocalStream] = useState(null);
    const interviewScheduleId = scriptMeta.interviewId || null;
    // Ref so WebSocket closures always see the current value (avoids stale-state capture)
    const interviewScheduleIdRef = useRef(null);
    useEffect(() => {
        interviewScheduleIdRef.current = scriptMeta.interviewId || null;
    }, [scriptMeta.interviewId]);

    useEffect(() => {
        setRoomSnapshot(null);
        setHumanChatOpen(false);
        setHumanChatDraft("");
        setHumanChatMessages([]);
        setHumanChatError("");
        setRemoteStreams([]);
        setRemoteScreenStreams([]);
        setRemoteScreenSharingPeers(new Set());
        remoteCameraStreamsRef.current = {};
        remoteScreenStreamsRef.current = {};
        remoteScreenTrackIdsRef.current = {};
    }, [candidateId, jobId, roomId]);

    const theme = useTheme();

    // Fallback to system preference if theme is not configured
    const systemPrefersDark =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;

    const isDarkMode =
        (theme && theme.palette && theme.palette.mode === "dark") ||
        systemPrefersDark;

    const isXs = useMediaQuery(theme.breakpoints.down("sm"));
    const isSm = useMediaQuery(theme.breakpoints.down("md"));
    const isMd = useMediaQuery(theme.breakpoints.down("lg"));


    const isAIInterviewer = scriptMeta.interviewerType === "AI";
    const isHybridInterviewer = scriptMeta.interviewerType === "Human+AI";
    const isCodingRound = scriptMeta.roundType === "Coding";

    // Identity verification derived values
    const identityVerification = scriptMeta.identityVerification || {};
    const isIdentityVerificationRequired = identityVerification?.required === true && identityVerification?.status !== "NotRequired";
    const isIdentityVerificationCompleted = identityVerification?.status === "Completed";
    const identityReferenceDescriptor = Array.isArray(identityVerification?.referenceDescriptor) ? identityVerification.referenceDescriptor : [];
    const identityMatchThresholdPercent = Number(identityVerification?.matchThresholdPercent) > 0 ? Number(identityVerification.matchThresholdPercent) : 70;
    const shouldRunIdentityChecks = isAIInterviewer && isIdentityVerificationRequired && isIdentityVerificationCompleted && identityReferenceDescriptor.length >= 32;

    const MIN_DURATION_MS = 500;
    const RECORDING_DURATION_MS = 300000;
    const SILENCE_TIMEOUT_MS = 2 * 60 * 1000;
    const SILENCE_PROMPT_LIMIT = 2;
    const MIC_LEVEL_THRESHOLD = 0.03;
    const MIC_LEVEL_SCALE = 3;
    const MIC_LEVEL_UPDATE_MS = 120;
    const MIC_ACTIVE_HIT_COUNT = 6;

    // Determine user role (simplistic approach for now)
    useEffect(() => {
        // If we are showing an AI interviewer, the user is the Candidate.
        if (isAIInterviewer) {
            setUserRole('candidate');
        } else {
            // Human-to-Human Mode
            // Check if the current user is a Recruiter or Admin based on Auth Context
            const user = authState?.user;
            const role = user?.role;
            //TODO: Verify who can access link from inetrviewer side
            if (role === 'recruiter' || role === 'manager' || role === 'client_admin' || role === 'ultra_admin' || role === 'interviewer') {
                setUserRole('interviewer');
                console.log("[WebRTC] User identified as INTERVIEWER (Role: " + role + ")");
            } else {
                setUserRole('candidate');
                console.log("[WebRTC] User identified as CANDIDATE (Role: " + (role || 'guest') + ")");
            }
        }
    }, [isAIInterviewer, authState, interviewerTypeFromUrl]);

    // Fetch server time on mount
    useEffect(() => {
        fetch('/api/ai/recording-auth/time')
            .then(r => r.json())
            .then(data => {
                if (data.time) {
                    const now = Date.now();
                    serverTimeOffsetRef.current = data.time - now;
                    console.log("[WebRTC] Server time offset:", serverTimeOffsetRef.current);
                }
            })
            .catch(err => console.error("[WebRTC] Failed to fetch server time:", err));
    }, []);

    // keep isRecordingRef in sync with state
    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
        aiSpeakingRef.current = aiSpeaking;
    }, [aiSpeaking]);

    useEffect(() => {
        isInterviewPausedRef.current = isInterviewPaused;
    }, [isInterviewPaused]);

    useEffect(() => {
        isInterviewActiveRef.current = isInterviewActive;
    }, [isInterviewActive]);

    useEffect(() => {
        slowModeRef.current = isSlowMode;
    }, [isSlowMode]);

    useEffect(() => {
        setSystemCheckResults((prev) => ({
            ...prev,
            micActive: systemCheckMicOk,
            cameraActive: systemCheckCameraOk
        }));
    }, [systemCheckMicOk, systemCheckCameraOk]);

    useEffect(() => {
        systemCheckStreamRef.current = systemCheckStream;
    }, [systemCheckStream]);

    // ---------- Anti-cheat runtime state ----------

    const [antiCheatState, setAntiCheatState] = useState(
        createInitialAntiCheatState
    );
    const antiCheatAutoEndTriggeredRef = useRef(false);

    const antiCheatConfig =
        scriptMeta.antiCheatConfig || defaultAntiCheatConfig;

    // Anti-cheat is active only for AI-led interviews
    const isAntiCheatEnabled = isAIInterviewer && !!antiCheatConfig.isEnabled;
    const isAntiCheatActive =
        isAntiCheatEnabled && consentAccepted && isInterviewActive;
    const isCameraMandatory =
        isAntiCheatEnabled && antiCheatConfig.cameraRequired !== false;
    const maxTabSwitches =
        isAntiCheatEnabled &&
            typeof antiCheatConfig.tabSwitchLimit === "number"
            ? antiCheatConfig.tabSwitchLimit
            : defaultAntiCheatConfig.tabSwitchLimit;
    const autoEndOnAntiCheatViolation =
        isAntiCheatEnabled && !!antiCheatConfig.autoEndOnViolation;

    const registerAntiCheatViolation = async (reason) => {
        if (!isAntiCheatActive || !isInterviewActive) return;

        setAntiCheatState(prev => {
            const isTabRelated = reason === "TAB_HIDDEN" || reason === "WINDOW_BLUR";
            const updatedTabSwitchCount = isTabRelated ? prev.tabSwitchCount + 1 : prev.tabSwitchCount;
            const updatedViolationCount = prev.violationCount + 1;
            const prevReasonCounts = prev.reasonCounts;
            const updatedReasonCounts = {
                ...prevReasonCounts,
                [reason]: (prevReasonCounts[reason] || 0) + 1
            };
            const nextState = {
                ...prev,
                tabSwitchCount: updatedTabSwitchCount,
                lastViolationReason: reason,
                hasActiveViolationBanner: true,
                violationCount: updatedViolationCount,
                reasonCounts: updatedReasonCounts
            };

            // Global rule: if overall violations >= 5, end interview immediately
            // if (!antiCheatAutoEndTriggeredRef.current && updatedViolationCount >= 5) {
            //     antiCheatAutoEndTriggeredRef.current = true;
            //     setIsInterviewActive(false);
            //     setTimeout(handleConfirmEnd, 0);
            // }
            // Existing config-driven auto-end based on tab switches
            if (autoEndOnAntiCheatViolation && !antiCheatAutoEndTriggeredRef.current && maxTabSwitches >= 0 && updatedTabSwitchCount > maxTabSwitches) {
                antiCheatAutoEndTriggeredRef.current = true;
                setIsInterviewActive(false);
                setTimeout(handleConfirmEnd, 0);
            }

            // NEW: Immediately persist to backend when violation detected
            if (candidateId && jobId && isAIInterviewer) {
                const violationSnapshot = {
                    reason,
                    tabSwitchCount: nextState.tabSwitchCount,
                    violationCount: nextState.violationCount,
                    reasonCounts: nextState.reasonCounts,
                    timestamp: new Date().toISOString(),
                    detectedAt: performance.now()
                };
                console.log("[AntiCheat] Immediate violation store →", reason, violationSnapshot); // LOG for verification

                fetchData('/api/ai/antiCheat/event', {
                    method: 'POST',
                    body: {
                        candidateId,
                        jobId,
                        interviewScheduleId,
                        reason,
                        meta: violationSnapshot
                    }
                }).then((res) => {
                    if (res?.state) {
                        setAntiCheatState((prevState) => ({
                            ...prevState,
                            tabSwitchCount: Math.max(prevState.tabSwitchCount, res.state.tabSwitchCount || 0),
                            violationCount: Math.max(prevState.violationCount, res.state.violationCount || 0),
                            lastViolationReason: res.state.lastViolationReason || prevState.lastViolationReason,
                            reasonCounts: {
                                ...prevState.reasonCounts,
                                ...(res.state.reasonCounts || {})
                            }
                        }));
                    }
                    if (res?.shouldEnd && !antiCheatAutoEndTriggeredRef.current) {
                        antiCheatAutoEndTriggeredRef.current = true;
                        setIsInterviewActive(false);
                        setTimeout(handleConfirmEnd, 0);
                    }
                }).catch(err => {
                    console.error("[AntiCheat] Failed to store violation immediately:", err);
                });
            }

            return nextState;
        });
    };

    // Attach anti-cheat hooks
    useTabAndWindowAntiCheat(isAntiCheatActive, registerAntiCheatViolation);

    useCameraTrackAntiCheat({
        isAntiCheatEnabled: isAntiCheatActive,
        cameraTrackRef: originalVideoTrackRef,
        videoRef,
        registerViolation: registerAntiCheatViolation
    });

    useSinglePersonDetection({
        isEnabled:
            isAntiCheatActive &&
            antiCheatConfig.singlePersonInFrameRequired !== false,
        videoRef,
        detectionIntervalMs:
            antiCheatConfig.faceCheckIntervalMs ||
            defaultAntiCheatConfig.faceCheckIntervalMs,
        registerViolation: registerAntiCheatViolation
    });

    useMultipleVoiceDetection({
        isEnabled:
            isAntiCheatActive &&
            antiCheatConfig.multiVoiceDetectionEnabled !== false,
        audioContextRef,
        audioStreamRef: mixedStreamRef,
        detectionIntervalMs:
            antiCheatConfig.voiceDetectionIntervalMs ||
            defaultAntiCheatConfig.voiceDetectionIntervalMs,
        registerViolation: registerAntiCheatViolation
    });

    useScreenshotAntiCheat({
        isEnabled:
            isAntiCheatActive &&
            antiCheatConfig.screenshotDetectionEnabled !== false,
        cooldownMs:
            antiCheatConfig.screenshotAttemptCooldownMs ||
            defaultAntiCheatConfig.screenshotAttemptCooldownMs,
        registerViolation: registerAntiCheatViolation
    });

    // Block clipboard actions during coding interviews when anti-cheat is active
    useClipboardBlocker(isAntiCheatActive && isCodingRound);

    // ─── Continuous face identity matching (runs only when verification is required & completed) ───
    useEffect(() => {
        if (!shouldRunIdentityChecks) return;

        const CHECK_INTERVAL_MS = 3500;
        const MISMATCH_EVENT_COOLDOWN_MS = 8000;
        const MATCH_PERSIST_INTERVAL_MS = 30000;
        let cancelled = false;

        const persistMatchLog = async ({ score, matched, faceCount, reason }) => {
            if (!candidateId || !jobId) return;
            try {
                await fetchData("/api/interviewschedules/verification/match-log", {
                    method: "POST",
                    body: { candidateId, jobId, interviewScheduleId, matchScore: score, matched, faceCount, reason }
                });
            } catch { /* non-blocking */ }
        };

        const runCheck = async () => {
            if (cancelled || faceMatchCheckInFlightRef.current) return;
            const videoEl = videoRef?.current;
            if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

            faceMatchCheckInFlightRef.current = true;
            try {
                const descriptorResult = await createFaceDescriptorFromSource(videoEl, { descriptorSize: 32, minFaceRatio: 0.035 });
                if (cancelled) return;

                if (!descriptorResult?.ok) {
                    const reason = descriptorResult?.error || "Unable to verify face from live camera";
                    if (reason === "Face is too small in frame" && (descriptorResult?.faceCount ?? 0) === 1) {
                        setFaceMatchState({ score: null, matched: true, checkedAt: Date.now(), reason: "Move closer to camera", faceCount: 1 });
                        setFaceMismatchOpen(false);
                        return;
                    }
                    setFaceMatchState({ score: 0, matched: false, checkedAt: Date.now(), reason, faceCount: descriptorResult?.faceCount ?? 0 });
                    setFaceMismatchOpen(true);
                    const now = Date.now();
                    if (now - lastFaceMismatchEventAtRef.current >= MISMATCH_EVENT_COOLDOWN_MS) {
                        lastFaceMismatchEventAtRef.current = now;
                        void persistMatchLog({ score: 0, matched: false, faceCount: descriptorResult?.faceCount ?? 0, reason });
                    }
                    return;
                }

                const referenceIsLegacy = identityReferenceDescriptor.length > 256;
                const liveDescriptor = referenceIsLegacy && Array.isArray(descriptorResult?.legacyDescriptor) && descriptorResult.legacyDescriptor.length >= 32
                    ? descriptorResult.legacyDescriptor
                    : (descriptorResult.descriptor || []);

                const score = compareFaceDescriptors(identityReferenceDescriptor, liveDescriptor);
                const matched = score >= identityMatchThresholdPercent;

                setFaceMatchState({ score, matched, checkedAt: Date.now(), reason: matched ? null : "Face does not match verification media", faceCount: descriptorResult?.faceCount ?? 1 });

                if (!matched) {
                    setFaceMismatchOpen(true);
                    const now = Date.now();
                    if (now - lastFaceMismatchEventAtRef.current >= MISMATCH_EVENT_COOLDOWN_MS) {
                        lastFaceMismatchEventAtRef.current = now;
                        void persistMatchLog({ score, matched: false, faceCount: descriptorResult?.faceCount ?? 1, reason: "Face score below threshold" });
                    }
                } else {
                    setFaceMismatchOpen(false);
                    const now = Date.now();
                    if (now - lastFaceMatchPersistAtRef.current >= MATCH_PERSIST_INTERVAL_MS) {
                        lastFaceMatchPersistAtRef.current = now;
                        void persistMatchLog({ score, matched: true, faceCount: descriptorResult?.faceCount ?? 1, reason: null });
                    }
                }
            } catch (err) {
                console.error("[FaceMatch] Continuous check failed:", err);
            } finally {
                faceMatchCheckInFlightRef.current = false;
            }
        };

        void runCheck();
        const intervalId = window.setInterval(runCheck, CHECK_INTERVAL_MS);
        return () => { cancelled = true; window.clearInterval(intervalId); };
    }, [shouldRunIdentityChecks, identityReferenceDescriptor, identityMatchThresholdPercent, candidateId, jobId, interviewScheduleId]);

    /* ============================
     *   TIMER
     * ============================
     */
    useEffect(() => {
        console.log(
            "[WebRTC] Component mounted, localPeerId:",
            localPeerIdRef.current,
            "roomId:",
            roomId
        );
        return () => {
            console.log("[WebRTC] Component unmounted");
        };
    }, []);

    const computeCallLimitSeconds = (meta, startAtMs) => {
        const durationMinutes = Number(meta?.durationMinutes);
        const durationSeconds =
            Number.isFinite(durationMinutes) && durationMinutes > 0
                ? Math.round(durationMinutes * 60)
                : null;

        let remainingSeconds = null;
        if (meta?.accessEndsAt) {
            const endAtMs = new Date(meta.accessEndsAt).getTime();
            if (!Number.isNaN(endAtMs)) {
                const baseMs =
                    typeof startAtMs === "number" && Number.isFinite(startAtMs)
                        ? startAtMs
                        : Date.now();
                remainingSeconds = Math.max(
                    0,
                    Math.floor((endAtMs - baseMs) / 1000)
                );
            }
        }

        if (durationSeconds != null && remainingSeconds != null) {
            return Math.min(durationSeconds, remainingSeconds);
        }
        if (durationSeconds != null) return durationSeconds;
        return remainingSeconds;
    };

    const startCallTimer = () => {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setCallTime((t) => t + 1);
        }, 1000);
    };

    const stopSystemCheckMedia = (resetState = true) => {
        if (systemCheckRafRef.current) {
            cancelAnimationFrame(systemCheckRafRef.current);
            systemCheckRafRef.current = null;
        }
        if (systemCheckSourceRef.current) {
            try {
                systemCheckSourceRef.current.disconnect();
            } catch (err) {
                // ignore
            }
            systemCheckSourceRef.current = null;
        }
        if (systemCheckAnalyserRef.current) {
            try {
                systemCheckAnalyserRef.current.disconnect?.();
            } catch (err) {
                // ignore
            }
            systemCheckAnalyserRef.current = null;
        }
        if (systemCheckAudioCtxRef.current) {
            try {
                systemCheckAudioCtxRef.current.close();
            } catch (err) {
                // ignore
            }
            systemCheckAudioCtxRef.current = null;
        }

        const stream = systemCheckStreamRef.current;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        systemCheckStreamRef.current = null;
        systemCheckLastLevelUpdateRef.current = 0;
        systemCheckMicHitCountRef.current = 0;

        if (resetState) {
            setSystemCheckStream(null);
            setSystemCheckMicLevel(0);
            setSystemCheckMicOk(false);
            setSystemCheckCameraOk(false);
        }
    };

    const startSystemCheckMicMonitor = async (stream) => {
        if (!stream) return;
        try {
            const AudioContextRef = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextRef) return;
            const ctx =
                systemCheckAudioCtxRef.current || new AudioContextRef();
            systemCheckAudioCtxRef.current = ctx;
            if (ctx.state === "suspended") {
                await ctx.resume();
            }
            const source = ctx.createMediaStreamSource(stream);
            systemCheckSourceRef.current = source;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            systemCheckAnalyserRef.current = analyser;
            source.connect(analyser);

            const data = new Uint8Array(analyser.fftSize);

            const update = () => {
                if (!systemCheckAnalyserRef.current) return;
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i += 1) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                const level = Math.min(1, rms * MIC_LEVEL_SCALE);
                const now = performance?.now ? performance.now() : Date.now();
                if (!systemCheckLastLevelUpdateRef.current ||
                    now - systemCheckLastLevelUpdateRef.current > MIC_LEVEL_UPDATE_MS) {
                    systemCheckLastLevelUpdateRef.current = now;
                    setSystemCheckMicLevel(level);
                }
                if (rms >= MIC_LEVEL_THRESHOLD) {
                    systemCheckMicHitCountRef.current = Math.min(
                        MIC_ACTIVE_HIT_COUNT,
                        systemCheckMicHitCountRef.current + 1
                    );
                } else {
                    systemCheckMicHitCountRef.current = Math.max(
                        0,
                        systemCheckMicHitCountRef.current - 1
                    );
                }
                if (systemCheckMicHitCountRef.current >= MIC_ACTIVE_HIT_COUNT) {
                    setSystemCheckMicOk(true);
                }
                systemCheckRafRef.current = requestAnimationFrame(update);
            };
            systemCheckRafRef.current = requestAnimationFrame(update);
        } catch (err) {
            console.warn("[WebRTC] Mic level monitor failed:", err);
        }
    };

    useEffect(() => {
        if (systemCheckPassed) {
            stopSystemCheckMedia();
        }
    }, [systemCheckPassed]);

    useEffect(() => () => {
        stopSystemCheckMedia(false);
    }, []);

    const runSystemCheck = async () => {
        if (systemCheckRunning) return;
        setSystemCheckRunning(true);
        setSystemCheckAttempted(true);
        setSystemCheckError("");
        stopSystemCheckMedia();
        setSystemCheckMicLevel(0);
        setSystemCheckMicOk(false);
        setSystemCheckCameraOk(false);
        systemCheckMicHitCountRef.current = 0;

        const browserOk =
            typeof RTCPeerConnection !== "undefined" &&
            typeof navigator !== "undefined" &&
            navigator?.mediaDevices &&
            typeof navigator.mediaDevices.getUserMedia === "function";

        const secureOk =
            typeof window !== "undefined" &&
            (window.isSecureContext ||
                ["localhost", "127.0.0.1"].includes(window.location.hostname));

        let devicesOk = false;
        let permissionsOk = false;
        let memoryValue = "unavailable";
        let tabMemoryValue = "unavailable";

        if (!browserOk) {
            setSystemCheckError("Your browser does not support WebRTC.");
        } else if (!secureOk) {
            setSystemCheckError("This page must be opened over HTTPS or localhost.");
        }

        if (typeof navigator !== "undefined") {
            const deviceMemory = navigator.deviceMemory;
            if (
                typeof deviceMemory === "number" &&
                Number.isFinite(deviceMemory) &&
                deviceMemory > 0
            ) {
                memoryValue = Math.round(deviceMemory * 10) / 10;
            }
        }

        if (typeof performance !== "undefined") {
            const heapLimit = performance?.memory?.jsHeapSizeLimit;
            if (
                typeof heapLimit === "number" &&
                Number.isFinite(heapLimit) &&
                heapLimit > 0
            ) {
                const heapGb = heapLimit / (1024 * 1024 * 1024);
                tabMemoryValue = Math.round(heapGb * 10) / 10;
            }
        }

        try {
            if (navigator?.mediaDevices?.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const hasMic = devices.some((d) => d.kind === "audioinput");
                const hasCam = devices.some((d) => d.kind === "videoinput");
                devicesOk = hasMic && hasCam;
            }
        } catch (err) {
            devicesOk = false;
        }

        if (browserOk && secureOk) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true
                });
                const hasAudio = stream.getAudioTracks().length > 0;
                const hasVideo = stream.getVideoTracks().length > 0;
                permissionsOk = hasAudio && hasVideo;
                if (!devicesOk) {
                    devicesOk = hasAudio && hasVideo;
                }
                const videoTrack = stream.getVideoTracks()[0] || null;
                const cameraOk = Boolean(
                    videoTrack &&
                    videoTrack.readyState === "live"
                );
                if (videoTrack) {
                    videoTrack.onended = () => setSystemCheckCameraOk(false);
                }
                setSystemCheckCameraOk(cameraOk);
                setSystemCheckStream(stream);
                systemCheckStreamRef.current = stream;
                startSystemCheckMicMonitor(stream);
            } catch (err) {
                permissionsOk = false;
                const errName = err?.name || "";
                if (errName === "NotAllowedError") {
                    setSystemCheckError("Please allow camera and microphone permissions.");
                } else if (errName === "NotFoundError") {
                    setSystemCheckError("Camera or microphone not found.");
                } else if (!secureOk) {
                    setSystemCheckError("This page must be opened over HTTPS or localhost.");
                } else {
                    setSystemCheckError(err?.message || "System check failed.");
                }
            }
        }

        setSystemCheckResults({
            browser: browserOk,
            secure: secureOk,
            devices: devicesOk,
            permissions: permissionsOk,
            memory: memoryValue,
            tabMemory: tabMemoryValue,
            cameraActive: systemCheckCameraOk,
            micActive: systemCheckMicOk
        });
        setSystemCheckRunning(false);
    };

    const handleStartInterview = async () => {
        if (!consentChecked || consentSubmitting) return;
        setConsentSubmitting(true);
        setLinkError(null);
        try {
            if (accessToken && userRole === 'candidate') {
                await fetchData('/api/interviewschedules/consume-token', {
                    method: 'POST',
                    body: {
                        candidateId,
                        jobId,
                        accessToken
                    }
                });
            }
            interviewEndedRef.current = false;
            endInProgressRef.current = false;
            stopSilenceWatch({ resetPromptCount: true });
            setConsentAccepted(true);
            setIsInterviewActive(true);
            speakGreeting();
        } catch (err) {
            console.error('[WebRTC] Failed to consume interview token:', err);
            const message =
                err?.error ||
                err?.message ||
                'This interview link is no longer valid.';
            setLinkError(message);
        } finally {
            setConsentSubmitting(false);
        }
    };

    useEffect(() => {
        if (!consentAccepted) {
            setCallLimitSeconds(null);
            return;
        }
        const limitSeconds = computeCallLimitSeconds(
            scriptMeta,
            callStartAtRef.current
        );
        setCallLimitSeconds(limitSeconds);
    }, [consentAccepted, scriptMeta.durationMinutes, scriptMeta.accessEndsAt]);

    useEffect(() => {
        if (!consentAccepted) return;
        autoEndTriggeredRef.current = false;
        callStartAtRef.current = Date.now();
        setCallTime(0);
        startCallTimer();
        return () => {
            clearInterval(timerRef.current);
        };
    }, [consentAccepted]);

    useEffect(() => {
        if (!consentAccepted || callLimitSeconds == null) return;
        if (callTime >= callLimitSeconds && !autoEndTriggeredRef.current) {
            autoEndTriggeredRef.current = true;
            handleConfirmEnd();
        }
    }, [callTime, callLimitSeconds, consentAccepted]);

    /* ============================
     *   LOAD SCRIPT META
     * ============================
     */
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!candidateId || !jobId) {
                console.warn(
                    "[WebRTC] Missing cid/jid in URL, scriptMeta will be generic"
                );
                return;
            }

            const cacheKey = `${candidateId}:${jobId}:${accessToken || ""}`;

            try {
                setLinkError(null);
                console.log("[WebRTC] Fetching script meta for", {
                    candidateId,
                    jobId
                });
                const tokenParam = accessToken
                    ? `&token=${encodeURIComponent(accessToken)}`
                    : "";
                const sidParam = scheduleIdFromUrl
                    ? `&sid=${encodeURIComponent(scheduleIdFromUrl)}`
                    : "";
                const url = `/api/interviewschedules/script?candidateId=${candidateId}&jobId=${jobId}${sidParam}${tokenParam}`;
                let pending = scriptMetaPromiseCache.get(cacheKey);

                if (!pending) {
                    pending = fetchData(url);
                    scriptMetaPromiseCache.set(cacheKey, pending);
                }

                const data = await pending;

                if (!data) {
                    console.warn("[WebRTC] /script returned no data");
                    scriptMetaPromiseCache.delete(cacheKey);
                    return;
                }

                const mergedAntiCheatConfig = {
                    ...defaultAntiCheatConfig,
                    ...(data.antiCheatConfig || {})
                };

                const meta = {
                    technicalScript: data.technicalScript || "",
                    candidateName: data.candidateName || "",
                    jobTitle: data.jobTitle || "",
                    interviewerType:
                        data.interviewerType || interviewerTypeFromUrl || "AI",
                    antiCheatConfig: mergedAntiCheatConfig,
                    durationMinutes: data.durationMinutes ?? null,
                    accessEndsAt: data.accessEndsAt ?? null,
                    roundType: data.roundType || "Speaking",
                    interviewId: data.interviewId || null,
                    problem: data.problem || null,
                    testCases: Array.isArray(data.testCases) ? data.testCases : [],
                    identityVerification: data.identityVerification || { status: "NotRequired", required: false, referenceDescriptor: [], matchThresholdPercent: 70, mismatchCount: 0 },
                    readingPassageEnabled: data.readingPassageEnabled === true,
                };

                setTimeout(() => {
                    scriptMetaPromiseCache.delete(cacheKey);
                }, SCRIPT_META_CACHE_TTL_MS);

                if (!cancelled) {
                    // If face detection is required but candidate hasn't verified yet, redirect to verification page
                    const iv = meta.identityVerification || {};
                    // Identify candidate access: token-based auth OR AI interviewer type (candidate is the interviewee)
                    const isCandidateAccess = !!accessToken || data.interviewerType === 'AI';
                    if (isCandidateAccess && iv.required === true && iv.status !== 'Completed') {
                        const params = new URLSearchParams();
                        if (candidateId) params.set('cid', candidateId);
                        if (jobId) params.set('jid', jobId);
                        if (scheduleIdFromUrl) params.set('sid', scheduleIdFromUrl);
                        if (accessToken) params.set('token', accessToken);
                        navigate(`/interview-verification/?${params.toString()}`, { replace: true });
                        return;
                    }
                    setScriptMeta(meta);
                }

                console.log("[WebRTC] Script meta loaded (v2 Check):", {
                    interviewerType:
                        data.interviewerType || interviewerTypeFromUrl || "AI",
                    jobTitle: data.jobTitle,
                    candidateName: data.candidateName,
                    interviewScheduleId: data.interviewId || null,
                    antiCheatConfig: mergedAntiCheatConfig,
                    roundType: data.roundType,
                    hasProblem: !!data.problem,
                    fullData: data
                });
            } catch (err) {
                console.error("[WebRTC] Failed to load technical script:", err);
                const message =
                    err?.error ||
                    err?.message ||
                    "This interview link is no longer valid.";
                scriptMetaPromiseCache.delete(cacheKey);
                if (!cancelled) setLinkError(message);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [candidateId, jobId, interviewerTypeFromUrl, accessToken]);

    /* ============================
     *   COMPOSITE CANVAS DRAWING
     * ============================
     */
    const drawCompositeFrame = (ctx, width, height) => {
        if (!ctx) return;

        // Clear background
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        const videos = [];

        // Local self-view
        if (videoRef.current) {
            videos.push(videoRef.current);
        }

        // Hidden remote video elements
        Object.values(remoteVideoElsRef.current).forEach((el) => {
            if (el) videos.push(el);
        });

        const count = videos.length;
        if (!count) return;

        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const tileWidth = width / cols;
        const tileHeight = height / rows;

        for (let i = 0; i < count; i++) {
            const videoEl = videos[i];
            if (!videoEl || videoEl.readyState < 2) continue;

            const row = Math.floor(i / cols);
            const col = i % cols;
            const x = col * tileWidth;
            const y = row * tileHeight;

            try {
                ctx.drawImage(videoEl, x, y, tileWidth, tileHeight);
            } catch {
                // ignore
            }
        }
    };

    /* ============================
     *   CHUNK UPLOAD HELPER
     * ============================
     */
    const uploadChunk = async (blob, trackTypeArg, seqNo, chunkStartMs, chunkEndMs, retryCount = 0) => {
        // Use provided trackType or default to userRole (Ref) or 'candidate'
        let trackType = trackTypeArg || userRole || 'candidate';

        // If trackType is interviewer, append the user ID to support multi-interviewer
        if (trackType === 'interviewer' && authState?.user?._id) {
            trackType = `interviewer_${authState.user._id}`;
        }

        console.log(`[RECORDING] Preparing uploadChunk: seq=${seqNo}, arg=${trackTypeArg}, state=${userRole}, final=${trackType}, interviewId=${interviewScheduleId}, start=${chunkStartMs}, end=${chunkEndMs}`);



        if (!interviewScheduleId) {
            console.warn('[RECORDING] uploadChunk skipped: no interviewScheduleId');
            return;
        }

        const formData = new FormData();
        formData.append('interviewScheduleId', interviewScheduleId);
        formData.append('candidateId', candidateId || '');
        formData.append('jobId', jobId || '');
        formData.append('trackType', trackType);
        formData.append('seqNo', seqNo);
        formData.append('mimeType', blob.type || 'video/webm');

        if (chunkStartMs !== undefined && chunkEndMs !== undefined) {
            formData.append('chunkStartMs', chunkStartMs);
            formData.append('chunkEndMs', chunkEndMs);
        }

        // If this is the first chunk OR we haven't sent start time yet, send it
        // Send trackStartMs with every chunk to ensure it gets saved even if chunk 0 fails
        if (trackStartMsRef.current) {
            formData.append('trackStartMs', String(trackStartMsRef.current));
        } else if (seqNo === 0) {
            console.warn(`[RECORDING] seqNo 0 but trackStartMsRef is null!`);
        }

        formData.append('file', blob, `${trackType}_${seqNo}.webm`);

        try {
            // ALWAYS use authenticated endpoint now
            const endpoint = '/api/ai/recording-auth/chunk';

            const token = getCookie('token') || localStorage.getItem('token');
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: formData,
                credentials: 'include'
            });
            if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
            console.log(`[RECORDING] Uploaded ${trackType} chunk #${seqNo} (${chunkStartMs}-${chunkEndMs}ms)`);
        } catch (err) {
            console.error(`[RECORDING] Chunk upload failed: ${trackType}#${seqNo}`, err);
            if (retryCount < 4) {
                const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s, 8s
                console.log(`[RECORDING] Retrying chunk ${trackType}#${seqNo} in ${delay}ms`);
                setTimeout(() => uploadChunk(blob, trackType, seqNo, chunkStartMs, chunkEndMs, retryCount + 1), delay);
            } else {
                console.error(`[RECORDING] Giving up on chunk ${trackType}#${seqNo} after ${retryCount} retries`);
            }
        }
    };

    const getLocalHumanChatSender = () => {
        if (userRole === "interviewer") {
            const user = authState?.user;
            const interviewerName =
                (`${user?.firstName || ""} ${user?.lastName || ""}`).trim() ||
                user?.email ||
                "Interviewer";

            return {
                senderName: interviewerName,
                senderRole: "interviewer"
            };
        }

        return {
            senderName: scriptMeta.candidateName || "Candidate",
            senderRole: "candidate"
        };
    };

    const appendHumanChatMessage = (message) => {
        if (!message) return;
        setHumanChatMessages((prev) => [...prev, message]);
    };

    const broadcastTranscriptEntry = (text, senderName, senderRole) => {
        if (isAIInterviewer) return;
        const socket = signalingRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        try {
            socket.send(JSON.stringify({
                type: "transcript-entry",
                from: localPeerIdRef.current,
                payload: { text, senderName, senderRole, createdAt: new Date().toISOString() }
            }));
        } catch (err) {
            console.warn("[WebRTC] Failed to broadcast transcript entry:", err);
        }
    };

    const sendHumanChatPayload = (payload) => {
        const socket = signalingRef.current;

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            setHumanChatError(
                "Chat is unavailable until the interview room connection is ready."
            );
            return false;
        }

        try {
            socket.send(
                JSON.stringify({
                    type: payload.type,
                    from: localPeerIdRef.current,
                    payload: payload.data
                })
            );
            setHumanChatError("");
            return true;
        } catch (err) {
            console.error("[WebRTC] Failed to send chat payload:", err);
            setHumanChatError("Unable to send chat right now. Please retry.");
            return false;
        }
    };

    const saveChatMessage = (message) => {
        const schedId = interviewScheduleIdRef.current;
        console.log("[ChatSave] saveChatMessage called — schedId:", schedId, "| messageId:", message?.id, "| kind:", message?.kind, "| senderRole:", message?.senderRole);
        if (!schedId) {
            console.warn("[ChatSave] Skipping — interviewScheduleIdRef is null/empty. scriptMeta.interviewId may not be set yet.");
            return;
        }
        const payload = {
            messageId: message.id,
            kind: message.kind,
            text: message.text || null,
            senderName: message.senderName || null,
            senderRole: message.senderRole || null,
        };
        if (message.kind === "file" && message.file) {
            // Only store file metadata, NOT the base64 dataUrl
            payload.file = {
                name: message.file.name || null,
                size: message.file.size || 0,
                mimeType: message.file.mimeType || null,
            };
        }
        console.log("[ChatSave] Sending POST to /api/interviewschedules/" + schedId + "/chat | payload:", JSON.stringify(payload));
        fetchData(`/api/interviewschedules/${schedId}/chat`, {
            method: "POST",
            body: payload,
        }).then((res) => {
            console.log("[ChatSave] POST success:", res);
        }).catch((err) => {
            console.warn("[ChatSave] POST failed:", err);
        });
    };

    const handleSendHumanChatMessage = () => {
        const text = (humanChatDraft || "").trim();
        if (!text) return;

        const { senderName, senderRole } = getLocalHumanChatSender();
        const createdAt = new Date().toISOString();
        const nextMessage = {
            id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            kind: "text",
            text,
            senderName,
            senderRole,
            createdAt,
            isOwn: true
        };

        const didSend = sendHumanChatPayload({
            type: "chat-message",
            data: {
                id: nextMessage.id,
                text,
                senderName,
                senderRole,
                createdAt
            }
        });

        if (!didSend) return;

        appendHumanChatMessage(nextMessage);
        saveChatMessage(nextMessage);
        setHumanChatDraft("");
        setHumanChatOpen(true);
    };

    const handleSendHumanChatFile = (file) => {
        if (!file) return;

        const maxFileBytes = 3 * 1024 * 1024;
        if (file.size > maxFileBytes) {
            setHumanChatError(
                "Please upload a document smaller than 3 MB in the chat drawer."
            );
            setHumanChatOpen(true);
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const dataUrl =
                typeof reader.result === "string" ? reader.result : "";

            if (!dataUrl) {
                setHumanChatError("Unable to read the selected document.");
                setHumanChatOpen(true);
                return;
            }

            const { senderName, senderRole } = getLocalHumanChatSender();
            const createdAt = new Date().toISOString();
            const nextMessage = {
                id: `chat_file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                kind: "file",
                text: (humanChatDraft || "").trim() || null,
                file: {
                    name: file.name,
                    size: file.size,
                    mimeType: file.type || "application/octet-stream",
                    dataUrl
                },
                senderName,
                senderRole,
                createdAt,
                isOwn: true
            };

            const didSend = sendHumanChatPayload({
                type: "chat-file",
                data: {
                    id: nextMessage.id,
                    text: nextMessage.text,
                    file: nextMessage.file,
                    senderName,
                    senderRole,
                    createdAt
                }
            });

            if (!didSend) return;

            appendHumanChatMessage(nextMessage);
            saveChatMessage(nextMessage);
            setHumanChatDraft("");
            setHumanChatOpen(true);
        };

        reader.onerror = () => {
            setHumanChatError("Unable to read the selected document.");
            setHumanChatOpen(true);
        };

        reader.readAsDataURL(file);
    };

    /* ============================
     *   PEER MANAGEMENT HELPERS 
     * ============================
     */

    const sendSignalingMessage = (message) => {
        const socket = signalingRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        try {
            socket.send(JSON.stringify(message));
            return true;
        } catch (err) {
            console.warn("[WebRTC] Failed to send signaling message:", err);
            return false;
        }
    };

    const sendScreenShareSignal = (type, { to = null, trackId = null } = {}) =>
        sendSignalingMessage({
            type,
            from: localPeerIdRef.current,
            ...(to ? { to } : {}),
            payload: {
                trackId: trackId || null
            }
        });

    const inferIsScreenTrack = (track) => {
        const label = String(track?.label || "").toLowerCase();
        return /(screen|window|display|monitor|share)/i.test(label);
    };

    const addRemoteCameraStream = (remotePeerId, stream) => {
        if (!remotePeerId || !stream) return;
        remoteCameraStreamsRef.current[remotePeerId] = stream;
        setRemoteStreams((prev) => {
            const existing = prev.find((entry) => entry.id === remotePeerId);
            if (existing) {
                return prev.map((entry) =>
                    entry.id === remotePeerId
                        ? { ...entry, stream }
                        : entry
                );
            }
            return [...prev, { id: remotePeerId, stream }];
        });
    };

    const removeRemoteCameraStream = (remotePeerId) => {
        if (!remotePeerId) return;
        delete remoteCameraStreamsRef.current[remotePeerId];
        setRemoteStreams((prev) =>
            prev.filter((entry) => entry.id !== remotePeerId)
        );
    };

    const addRemoteScreenStream = (remotePeerId, stream, trackId = null) => {
        if (!remotePeerId || !stream) return;
        remoteScreenStreamsRef.current[remotePeerId] = {
            stream,
            trackId: trackId || null
        };
        setRemoteScreenStreams((prev) => {
            const withoutPeer = prev.filter((entry) => entry.id !== remotePeerId);
            return [
                ...withoutPeer,
                {
                    id: remotePeerId,
                    stream,
                    trackId: trackId || null
                }
            ];
        });
        setRemoteScreenSharingPeers((prev) => {
            const next = new Set(prev);
            next.add(remotePeerId);
            return next;
        });
    };

    const removeRemoteScreenStream = (remotePeerId, trackId = null) => {
        if (!remotePeerId) return;
        const existing = remoteScreenStreamsRef.current[remotePeerId];
        if (!existing) return;
        if (trackId && existing.trackId && existing.trackId !== trackId) return;
        delete remoteScreenStreamsRef.current[remotePeerId];
        setRemoteScreenStreams((prev) =>
            prev.filter((entry) => entry.id !== remotePeerId)
        );
        if (!remoteScreenTrackIdsRef.current[remotePeerId]) {
            setRemoteScreenSharingPeers((prev) => {
                const next = new Set(prev);
                next.delete(remotePeerId);
                return next;
            });
        }
    };

    const markRemoteScreenSharing = (remotePeerId, trackId = null) => {
        if (!remotePeerId) return;
        if (!remoteScreenTrackIdsRef.current[remotePeerId]) {
            remoteScreenTrackIdsRef.current[remotePeerId] = new Set();
        }
        if (trackId) {
            remoteScreenTrackIdsRef.current[remotePeerId].add(trackId);
        }
        remoteScreenSharingPeersRef.current.add(remotePeerId);
        setRemoteScreenSharingPeers((prev) => {
            const next = new Set(prev);
            next.add(remotePeerId);
            return next;
        });
    };

    const unmarkRemoteScreenSharing = (remotePeerId, trackId = null) => {
        if (!remotePeerId) return;
        const knownTrackIds = remoteScreenTrackIdsRef.current[remotePeerId];
        if (knownTrackIds) {
            if (trackId) {
                knownTrackIds.delete(trackId);
            } else {
                knownTrackIds.clear();
            }
            if (knownTrackIds.size === 0) {
                delete remoteScreenTrackIdsRef.current[remotePeerId];
            }
        }
        if (!remoteScreenStreamsRef.current[remotePeerId] &&
            !remoteScreenTrackIdsRef.current[remotePeerId]) {
            remoteScreenSharingPeersRef.current.delete(remotePeerId);
            setRemoteScreenSharingPeers((prev) => {
                const next = new Set(prev);
                next.delete(remotePeerId);
                return next;
            });
        }
    };

    const clearRemoteScreenPeerState = (remotePeerId) => {
        if (!remotePeerId) return;
        delete remoteScreenStreamsRef.current[remotePeerId];
        delete remoteScreenTrackIdsRef.current[remotePeerId];
        delete promotedCameraStreamsRef.current[remotePeerId];
        remoteScreenSharingPeersRef.current.delete(remotePeerId);
        setRemoteScreenStreams((prev) =>
            prev.filter((entry) => entry.id !== remotePeerId)
        );
        setRemoteScreenSharingPeers((prev) => {
            const next = new Set(prev);
            next.delete(remotePeerId);
            return next;
        });
    };

    const restorePromotedCameraStream = (remotePeerId) => {
        if (!remotePeerId) return;
        const promotedStream = promotedCameraStreamsRef.current[remotePeerId];
        if (!promotedStream) return;

        const hasLiveVideo = promotedStream
            .getVideoTracks()
            .some((track) => track.readyState === "live");

        if (hasLiveVideo) {
            addRemoteCameraStream(remotePeerId, promotedStream);
        }
        delete promotedCameraStreamsRef.current[remotePeerId];
    };

    const maybePromoteCameraStreamToScreen = (remotePeerId, trackId = null) => {
        const cameraStream = remoteCameraStreamsRef.current[remotePeerId];
        if (!cameraStream || !trackId) return;
        const cameraVideoTrack = cameraStream
            .getVideoTracks()
            .find((track) => track.id === trackId);
        if (!cameraVideoTrack) return;

        const existingScreenEntry = remoteScreenStreamsRef.current[remotePeerId];
        addRemoteScreenStream(remotePeerId, cameraStream, trackId);
        if (existingScreenEntry && existingScreenEntry.trackId !== trackId) {
            addRemoteCameraStream(remotePeerId, existingScreenEntry.stream);
        } else {
            promotedCameraStreamsRef.current[remotePeerId] = cameraStream;
            removeRemoteCameraStream(remotePeerId);
        }
    };

    const renegotiatePeerConnection = async (
        remotePeerId,
        reason = "media-update"
    ) => {
        const pc = peersRef.current[remotePeerId];
        const socket = signalingRef.current;
        if (!pc || !socket || socket.readyState !== WebSocket.OPEN) return;
        if (renegotiatingPeersRef.current[remotePeerId]) return;

        if (pc.signalingState !== "stable") {
            console.log(
                `[WebRTC] Skipping renegotiation (${reason}) for ${remotePeerId}; signalingState=${pc.signalingState}`
            );
            return;
        }

        renegotiatingPeersRef.current[remotePeerId] = true;
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignalingMessage({
                type: "offer",
                from: localPeerIdRef.current,
                to: remotePeerId,
                sdp: offer
            });
            console.log(
                `[WebRTC] Sent renegotiation offer to ${remotePeerId} (${reason})`
            );
        } catch (err) {
            console.error(
                `[WebRTC] Failed renegotiation with ${remotePeerId} (${reason}):`,
                err
            );
        } finally {
            delete renegotiatingPeersRef.current[remotePeerId];
        }
    };

    const renegotiateAllPeers = async (reason = "media-update") => {
        const peerIds = Object.keys(peersRef.current);
        for (const remotePeerId of peerIds) {
            await renegotiatePeerConnection(remotePeerId, reason);
        }
    };

    const cleanupPeers = () => {
        console.log("[WebRTC] cleanupPeers – closing all RTCPeerConnections");
        Object.entries(peersRef.current).forEach(([pid, pc]) => {
            try {
                console.log("[WebRTC] Closing peer connection", pid);
                pc.close();
            } catch (err) {
                console.warn(
                    "[WebRTC] Error closing peer connection",
                    pid,
                    err
                );
            }
        });
        peersRef.current = {};
        renegotiatingPeersRef.current = {};
        setRemoteStreams([]);
        setRemoteScreenStreams([]);
        setRemoteScreenSharingPeers(new Set());
        remoteCameraStreamsRef.current = {};
        remoteScreenStreamsRef.current = {};
        remoteScreenTrackIdsRef.current = {};
        remoteScreenSharingPeersRef.current = new Set();
        promotedCameraStreamsRef.current = {};
        setRoomSnapshot(null);

        // Cleanup hidden remote video elements
        Object.entries(remoteVideoElsRef.current).forEach(([, el]) => {
            try {
                if (el) {
                    el.srcObject = null;
                }
            } catch {
                // ignore
            }
        });
        remoteVideoElsRef.current = {};

        // Cleanup remote audio sources
        Object.entries(remoteAudioSourcesRef.current).forEach(([, src]) => {
            try {
                if (src) {
                    src.disconnect();
                }
            } catch {
                // ignore
            }
        });
        remoteAudioSourcesRef.current = {};
    };

    const handleRemoteTrack = (remotePeerId, event) => {
        const [remoteStream] = event.streams;
        const incomingTrack = event.track;
        if (!remoteStream || !incomingTrack) {
            console.warn(
                "[WebRTC] ontrack fired without stream/track for",
                remotePeerId
            );
            return;
        }

        const knownScreenTrackIds = remoteScreenTrackIdsRef.current[remotePeerId];
        const cameraVideoTrack = remoteCameraStreamsRef.current[remotePeerId]
            ?.getVideoTracks?.()?.[0];
        const hasCameraAlready = Boolean(cameraVideoTrack);
        const peerMarkedScreenSharing =
            remoteScreenSharingPeersRef.current.has(remotePeerId);
        const isSecondVideoTrack =
            incomingTrack.kind === "video" &&
            hasCameraAlready &&
            cameraVideoTrack?.id !== incomingTrack.id;
        const shouldTreatAsScreen =
            incomingTrack.kind === "video" &&
            (
                Boolean(knownScreenTrackIds?.has(incomingTrack.id)) ||
                isSecondVideoTrack ||
                inferIsScreenTrack(incomingTrack) ||
                (peerMarkedScreenSharing && !hasCameraAlready)
            );

        console.log("[WebRTC] ontrack from peer", remotePeerId, {
            trackKind: incomingTrack.kind,
            trackId: incomingTrack.id,
            streamAudioTracks: remoteStream.getAudioTracks().length,
            streamVideoTracks: remoteStream.getVideoTracks().length,
            asScreen: shouldTreatAsScreen
        });

        if (shouldTreatAsScreen) {
            addRemoteScreenStream(remotePeerId, remoteStream, incomingTrack.id);
            markRemoteScreenSharing(remotePeerId, incomingTrack.id);
            incomingTrack.onended = () => {
                removeRemoteScreenStream(remotePeerId, incomingTrack.id);
                unmarkRemoteScreenSharing(remotePeerId, incomingTrack.id);
                restorePromotedCameraStream(remotePeerId);
            };
            return;
        }

        addRemoteCameraStream(remotePeerId, remoteStream);

        // Hidden remote video element for optional composite recording.
        try {
            let remoteVideoEl = remoteVideoElsRef.current[remotePeerId];
            if (!remoteVideoEl) {
                remoteVideoEl = document.createElement("video");
                remoteVideoEl.autoplay = true;
                remoteVideoEl.muted = true;
                remoteVideoEl.playsInline = true;
                remoteVideoElsRef.current[remotePeerId] = remoteVideoEl;
            }
            if (remoteVideoEl.srcObject !== remoteStream) {
                remoteVideoEl.srcObject = remoteStream;
            }
            remoteVideoEl
                .play()
                .catch((err) =>
                    console.warn("[WebRTC] Hidden remote video play error:", err)
                );
        } catch (err) {
            console.warn(
                "[WebRTC] Failed to attach hidden remote video element:",
                err
            );
        }

        try {
            const ctx = audioContextRef.current;
            if (
                ctx &&
                remoteStream.getAudioTracks().length > 0 &&
                !remoteAudioSourcesRef.current[remotePeerId]
            ) {
                const source = ctx.createMediaStreamSource(remoteStream);
                // Route remote audio to local speakers so the user can hear the other participant.
                // Do NOT connect to mixDest - that stream is sent via WebRTC and would
                // loop the remote audio back to them (causing echo).
                source.connect(ctx.destination);
                // Also include remote audio in the recording mix.
                if (recordingMixDestRef.current) {
                    source.connect(recordingMixDestRef.current);
                }
                remoteAudioSourcesRef.current[remotePeerId] = source;
            }
        } catch (err) {
            console.warn("[WebRTC] Failed to route remote audio:", err);
        }

        if (incomingTrack.kind === "video") {
            incomingTrack.onended = () => {
                const stillHasLiveVideo = remoteCameraStreamsRef.current[remotePeerId]
                    ?.getVideoTracks?.()
                    ?.some((track) => track.readyState === "live");
                if (!stillHasLiveVideo) {
                    removeRemoteCameraStream(remotePeerId);
                }
            };
        }
    };

    const createPeerConnection = (remotePeerId) => {
        if (peersRef.current[remotePeerId]) {
            return peersRef.current[remotePeerId];
        }

        console.log(
            "[WebRTC] createPeerConnection for remotePeerId:",
            remotePeerId
        );

        const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

        const pc = new RTCPeerConnection({ iceServers });

        const localStream =
            mixedStreamRef.current || videoRef.current?.srcObject || null;

        if (!localStream) {
            console.warn(
                "[WebRTC] No local stream when creating PC; tracks will be added later when available"
            );
        } else {
            localStream.getTracks().forEach((track) => {
                console.log(
                    "[WebRTC] Adding local track to PC",
                    remotePeerId,
                    track.kind
                );
                pc.addTrack(track, localStream);
            });
        }

        const activeScreenTrack = screenShareTrackRef.current;
        if (activeScreenTrack) {
            const displayStream =
                screenShareStreamRef.current ||
                new MediaStream([activeScreenTrack]);
            console.log(
                "[WebRTC] Adding active screen-share track to PC",
                remotePeerId
            );
            pc.addTrack(activeScreenTrack, displayStream);
        }

        pc.onicecandidate = (event) => {
            if (event.candidate && signalingRef.current) {
                const message = {
                    type: "ice-candidate",
                    from: localPeerIdRef.current,
                    to: remotePeerId,
                    candidate: event.candidate
                };
                console.log("[WebRTC] Sending ICE candidate to", remotePeerId);
                try {
                    signalingRef.current.send(JSON.stringify(message));
                } catch (err) {
                    console.warn("[WebRTC] Failed to send ICE candidate:", err);
                }
            }
        };

        pc.ontrack = (event) => handleRemoteTrack(remotePeerId, event);

        pc.oniceconnectionstatechange = () => {
            console.log(
                "[WebRTC] ICE connection state with",
                remotePeerId,
                "=>",
                pc.iceConnectionState
            );
        };

        pc.onconnectionstatechange = () => {
            console.log(
                "[WebRTC] Connection state with",
                remotePeerId,
                "=>",
                pc.connectionState
            );
            if (
                pc.connectionState === "disconnected" ||
                pc.connectionState === "failed" ||
                pc.connectionState === "closed"
            ) {
                console.log("[WebRTC] Removing remote stream for", remotePeerId);
                removeRemoteCameraStream(remotePeerId);
                clearRemoteScreenPeerState(remotePeerId);
                try {
                    pc.close();
                } catch {
                    // ignore
                }
                delete peersRef.current[remotePeerId];
                delete renegotiatingPeersRef.current[remotePeerId];

                try {
                    const hiddenVid = remoteVideoElsRef.current[remotePeerId];
                    if (hiddenVid) {
                        hiddenVid.srcObject = null;
                        delete remoteVideoElsRef.current[remotePeerId];
                    }
                } catch {
                    // ignore
                }
                try {
                    const src = remoteAudioSourcesRef.current[remotePeerId];
                    if (src) {
                        src.disconnect();
                        delete remoteAudioSourcesRef.current[remotePeerId];
                    }
                } catch {
                    // ignore
                }
            }
        };

        peersRef.current[remotePeerId] = pc;
        return pc;
    };

    /* ============================
     *   SIGNALING HANDLER
     * ============================
     */

    const handleSignalingMessage = async (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            console.warn("[WebRTC] Received non-JSON signaling message:", raw);
            return;
        }

        const localId = localPeerIdRef.current;

        if (msg.from === localId) return;

        if (msg.to && msg.to !== localId) {
            return;
        }

        const remoteId = msg.from;
        const type = msg.type;

        console.log("[WebRTC] Signaling message received:", {
            type,
            from: remoteId,
            to: msg.to,
            localId
        });

        switch (type) {
            case "join": {
                if (!mixedStreamRef.current && !videoRef.current?.srcObject) {
                    console.warn(
                        "[WebRTC] Received join but media not ready yet, ignoring"
                    );
                    return;
                }
                console.log(
                    "[WebRTC] Peer joined room, creating offer to",
                    remoteId
                );
                // Re-announce our name so the new peer learns who we are
                const socket = signalingRef.current;
                if (socket && socket.readyState === WebSocket.OPEN) {
                    const { senderName: myName, senderRole: myRole } = getLocalHumanChatSender();
                    socket.send(JSON.stringify({
                        type: "peer-info",
                        from: localPeerIdRef.current,
                        payload: { displayName: myName, role: myRole }
                    }));
                    if (screenShareTrackRef.current) {
                        sendScreenShareSignal("screen-share-start", {
                            to: remoteId,
                            trackId: screenShareTrackRef.current.id
                        });
                    }
                }
                const pc = createPeerConnection(remoteId);
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    const offerMsg = {
                        type: "offer",
                        from: localId,
                        to: remoteId,
                        sdp: offer
                    };
                    sendSignalingMessage(offerMsg);
                    console.log("[WebRTC] Sent offer to", remoteId);
                } catch (err) {
                    console.error("[WebRTC] Failed to create/send offer:", err);
                }
                break;
            }

            case "offer": {
                console.log("[WebRTC] Received offer from", remoteId);
                const pc = createPeerConnection(remoteId);

                try {
                    if (pc.signalingState === "have-local-offer") {
                        console.warn(
                            "[WebRTC] Rolling back local description before accepting offer from",
                            remoteId
                        );
                        await pc.setLocalDescription({ type: "rollback" });
                    }
                    await pc.setRemoteDescription(
                        new RTCSessionDescription(msg.sdp)
                    );
                    delete renegotiatingPeersRef.current[remoteId];

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    const answerMsg = {
                        type: "answer",
                        from: localId,
                        to: remoteId,
                        sdp: answer
                    };
                    sendSignalingMessage(answerMsg);
                    console.log("[WebRTC] Sent answer to", remoteId);
                } catch (err) {
                    console.error(
                        "[WebRTC] Failed to handle offer from",
                        remoteId,
                        err
                    );
                }
                break;
            }

            case "answer": {
                console.log("[WebRTC] Received answer from", remoteId);
                const pc = peersRef.current[remoteId];
                if (!pc) {
                    console.warn(
                        "[WebRTC] No RTCPeerConnection found for answer from",
                        remoteId
                    );
                    return;
                }
                try {
                    await pc.setRemoteDescription(
                        new RTCSessionDescription(msg.sdp)
                    );
                    delete renegotiatingPeersRef.current[remoteId];
                    console.log(
                        "[WebRTC] Remote description set (answer) from",
                        remoteId
                    );
                } catch (err) {
                    console.error(
                        "[WebRTC] Failed to handle answer from",
                        remoteId,
                        err
                    );
                }
                break;
            }

            case "room_state": {
                setRoomSnapshot(msg.data || null);
                break;
            }

            case "ice-candidate": {
                const pc = peersRef.current[remoteId];
                if (!pc) {
                    console.warn(
                        "[WebRTC] No RTCPeerConnection found for ICE from",
                        remoteId
                    );
                    return;
                }
                if (!msg.candidate) return;
                try {
                    await pc.addIceCandidate(
                        new RTCIceCandidate(msg.candidate)
                    );
                    console.log("[WebRTC] Added ICE candidate from", remoteId);
                } catch (err) {
                    console.error(
                        "[WebRTC] Failed to add ICE candidate from",
                        remoteId,
                        err
                    );
                }
                break;
            }

            case "chat-message": {
                const chatPayload = msg?.payload || {};
                const text = String(chatPayload.text || "").trim();
                if (!text) return;

                const receivedTextMsg = {
                    id:
                        chatPayload.id ||
                        `chat_remote_${Date.now()}_${Math.random()
                            .toString(36)
                            .slice(2, 8)}`,
                    kind: "text",
                    text,
                    senderName: chatPayload.senderName || null,
                    senderRole: chatPayload.senderRole === "interviewer" ? "interviewer" : "candidate",
                    createdAt:
                        chatPayload.createdAt || new Date().toISOString(),
                    isOwn: false
                };
                appendHumanChatMessage(receivedTextMsg);
                // Receiver also persists so both sides are stored (dedup by messageId)
                saveChatMessage(receivedTextMsg);
                setHumanChatOpen(true);
                setHumanChatError("");
                break;
            }

            case "chat-file": {
                const chatPayload = msg?.payload || {};
                const file = chatPayload.file || null;
                const hasAttachment =
                    file &&
                    typeof file.dataUrl === "string" &&
                    file.dataUrl.startsWith("data:");

                if (!hasAttachment) return;

                const receivedFileMsg = {
                    id:
                        chatPayload.id ||
                        `chat_file_remote_${Date.now()}_${Math.random()
                            .toString(36)
                            .slice(2, 8)}`,
                    kind: "file",
                    text: String(chatPayload.text || "").trim() || null,
                    file: {
                        name: file.name || "document",
                        size: Number(file.size) || 0,
                        mimeType:
                            file.mimeType || "application/octet-stream",
                        dataUrl: file.dataUrl
                    },
                    senderName: chatPayload.senderName || "Participant",
                    senderRole: chatPayload.senderRole || "participant",
                    createdAt:
                        chatPayload.createdAt || new Date().toISOString(),
                    isOwn: false
                };
                appendHumanChatMessage(receivedFileMsg);
                // Receiver persists metadata only (saveChatMessage strips dataUrl)
                saveChatMessage(receivedFileMsg);
                setHumanChatOpen(true);
                setHumanChatError("");
                break;
            }

            case "transcript-entry": {
                if (isAIInterviewer) break;
                const tPayload = msg?.payload || {};
                const tText = String(tPayload.text || "").trim();
                if (!tText) break;
                setConversation((prev) => [...prev, {
                    remote: tText,
                    remoteName: tPayload.senderName || "Participant",
                    remoteRole: tPayload.senderRole || "participant"
                }]);
                break;
            }

            case "peer-info": {
                const infoPayload = msg?.payload || {};
                const peerDisplayName = String(infoPayload.displayName || "").trim();
                const peerRole = String(infoPayload.role || "").trim();
                if (remoteId && peerDisplayName) {
                    const label = peerRole === "interviewer"
                        ? `Interviewer (${peerDisplayName})`
                        : `Candidate (${peerDisplayName})`;
                    setPeerNamesMap(prev => ({ ...prev, [remoteId]: label }));
                }
                break;
            }

            case "screen-share-start": {
                const sharePayload = msg?.payload || {};
                const trackId = String(sharePayload.trackId || "").trim() || null;
                markRemoteScreenSharing(remoteId, trackId);
                maybePromoteCameraStreamToScreen(remoteId, trackId);
                break;
            }

            case "screen-share-stop": {
                const sharePayload = msg?.payload || {};
                const trackId = String(sharePayload.trackId || "").trim() || null;
                removeRemoteScreenStream(remoteId, trackId);
                unmarkRemoteScreenSharing(remoteId, trackId);
                restorePromotedCameraStream(remoteId);
                break;
            }

            default:
                console.warn("[WebRTC] Unknown signaling message type:", type);
        }
    };

    const connectSignaling = () => {
        if (!roomId) {
            console.warn("[WebRTC] No roomId, not connecting signaling");
            return;
        }
        if (signalingRef.current) {
            console.log("[WebRTC] Signaling already connected, skipping");
            return;
        }

        try {
            const loc = typeof window !== "undefined" ? window.location : null;
            if (!loc) {
                console.error("[WebRTC] window.location not available");
                return;
            }

            const wsProtocol = loc.protocol === "https:" ? "wss:" : "ws:";

            let host = loc.host;
            if (loc.hostname === "localhost" && loc.port === "3000") {
                host = "localhost:8080";
            }

            const qs = new URLSearchParams();
            const authToken = getCookie("token") || localStorage.getItem("token") || "";
            if (authToken) qs.set("token", authToken);
            if (candidateId) qs.set("candidateId", candidateId);
            if (jobId) qs.set("jobId", jobId);
            if (interviewScheduleId) qs.set("interviewScheduleId", interviewScheduleId);
            qs.set("peerId", localPeerIdRef.current);
            const qsString = qs.toString();
            const wsUrl = `${wsProtocol}//${host}/api/webrtc/rooms/${roomId}${qsString ? `?${qsString}` : ""}`;

            console.log("[WebRTC] Connecting WebSocket signaling to", wsUrl);
            const ws = new WebSocket(wsUrl);

            signalingRef.current = ws;

            ws.onopen = () => {
                console.log("[WebRTC] WebSocket open – sending join", {
                    roomId,
                    localPeerId: localPeerIdRef.current
                });
                const joinMsg = {
                    type: "join",
                    from: localPeerIdRef.current,
                    candidateId,
                    jobId,
                    interviewScheduleId
                };
                ws.send(JSON.stringify(joinMsg));
                // Announce display name so remote peers can label our video frame
                const { senderName, senderRole } = getLocalHumanChatSender();
                ws.send(JSON.stringify({
                    type: "peer-info",
                    from: localPeerIdRef.current,
                    payload: { displayName: senderName, role: senderRole }
                }));
                if (screenShareTrackRef.current) {
                    ws.send(JSON.stringify({
                        type: "screen-share-start",
                        from: localPeerIdRef.current,
                        payload: { trackId: screenShareTrackRef.current.id }
                    }));
                }
            };

            ws.onmessage = (event) => {
                console.log(
                    "[WebRTC] WebSocket message received, length:",
                    typeof event.data === "string"
                        ? event.data.length
                        : "non-string"
                );
                handleSignalingMessage(event.data);
            };

            ws.onclose = (ev) => {
                console.warn("[WebRTC] WebSocket closed:", ev.code, ev.reason);
                signalingRef.current = null;
                cleanupPeers();
            };

            ws.onerror = (err) => {
                console.error("[WebRTC] WebSocket error:", err);
            };
        } catch (err) {
            console.error(
                "[WebRTC] Failed to establish signaling WebSocket:",
                err
            );
        }
    };

    /* ============================
     *   MEDIA SETUP
     * ============================
     */
    useEffect(() => {
        const setupMedia = async () => {
            if (!consentAccepted) {
                console.log("[WebRTC] Waiting for consent to start media");
                return;
            }
            console.log("[WebRTC] Requesting user media (video+audio)...");

            try {
                const nav = typeof navigator !== "undefined" ? navigator : null;

                if (!nav) {
                    console.error(
                        "[WebRTC] navigator is not available (non-browser environment)"
                    );
                    setMediaReady(false);
                    return;
                }

                const constraints = {
                    video: true,
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                };

                const getUserMediaSafe = () => {
                    if (
                        nav.mediaDevices &&
                        typeof nav.mediaDevices.getUserMedia === "function"
                    ) {
                        return nav.mediaDevices.getUserMedia(constraints);
                    }

                    const legacyGetUserMedia =
                        nav.getUserMedia ||
                        nav.webkitGetUserMedia ||
                        nav.mozGetUserMedia ||
                        nav.msGetUserMedia;

                    if (legacyGetUserMedia) {
                        return new Promise((resolve, reject) =>
                            legacyGetUserMedia.call(
                                nav,
                                constraints,
                                resolve,
                                reject
                            )
                        );
                    }

                    throw new Error(
                        "getUserMedia is not supported in this browser or this page is not served from a secure origin (https/localhost)."
                    );
                };

                const userStream = await getUserMediaSafe();
                userStreamRef.current = userStream;
                cameraStreamRef.current = userStream;
                console.log("[WebRTC] getUserMedia I changed this ", {
                    audioTracks: userStream.getAudioTracks().length,
                    videoTracks: userStream.getVideoTracks().length
                });

                // HARD-GUARD: if camera is mandatory but no video track, block access.
                if (
                    isAntiCheatEnabled &&
                    isCameraMandatory &&
                    userStream.getVideoTracks().length === 0
                ) {
                    console.warn(
                        "[AntiCheat] No video tracks while cameraRequired=true – blocking mediaReady"
                    );
                    registerAntiCheatViolation("CAMERA_TRACK_ENDED");
                    alert(
                        "Camera access is required for this interview. Please enable your camera and refresh the page."
                    );
                    setMediaReady(false);
                    userStream.getTracks().forEach((t) => t.stop());
                    userStreamRef.current = null;
                    return;
                }

                const AudioCtx =
                    window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioCtx();
                // TX mix: only local mic audio — this is what goes over WebRTC.
                // Remote audio must NOT be routed here or it will echo back to the remote peer.
                const mixDest = audioContext.createMediaStreamDestination();
                // Recording mix: local mic + remote audio — used only for the session recorder.
                const recordingMixDest = audioContext.createMediaStreamDestination();

                const micSource =
                    audioContext.createMediaStreamSource(userStream);
                micSource.connect(mixDest);          // WebRTC TX stream (mic only)
                micSource.connect(recordingMixDest); // Recording stream (mic side)

                const mixedStream = new MediaStream();
                userStream.getVideoTracks().forEach((track) => {
                    mixedStream.addTrack(track);
                    if (!originalVideoTrackRef.current) {
                        originalVideoTrackRef.current = track;
                    }
                });
                mixDest.stream.getAudioTracks().forEach((track) =>
                    mixedStream.addTrack(track)
                );

                if (videoRef.current) {
                    videoRef.current.srcObject = mixedStream;
                    setTimeout(() => {
                        videoRef.current
                            .play()
                            .catch((err) =>
                                console.warn(
                                    "[WebRTC] Local video play error:",
                                    err
                                )
                            );
                    }, 150);
                }

                audioContextRef.current = audioContext;
                mixDestRef.current = mixDest;
                recordingMixDestRef.current = recordingMixDest;
                mixedStreamRef.current = mixedStream;
                setLocalStream(mixedStream);

                try {
                    // Build a dedicated recording stream:
                    // - video from the local camera (same track as TX stream)
                    // - audio from recordingMixDest (local mic + remote audio added later in handleRemoteTrack)
                    // This keeps the TX stream (mixedStream) echo-free.
                    const recordingStream = new MediaStream([
                        ...mixedStream.getVideoTracks(),
                        ...recordingMixDest.stream.getAudioTracks(),
                    ]);
                    const shouldUseCompositeRecording = !isAIInterviewer;

                    // Canvas recording removed - causes corrupted WebM files
                    // Using mixedStream directly for reliable recording
                    console.log("[WebRTC] Recording stream ready (direct from mixedStream, no canvas)");

                    // VP8 is more reliable than VP9 for direct stream recording
                    // Produces valid WebM containers that FFmpeg can concatenate without errors
                    const fullMime =
                        MediaRecorder.isTypeSupported(
                            "video/webm;codecs=vp8,opus"
                        )
                            ? "video/webm;codecs=vp8,opus"
                            : "video/webm";

                    console.log(
                        "[RECORDING] Starting session recorder, mime:",
                        fullMime
                    );
                    const sessionRecorder = new MediaRecorder(recordingStream, {
                        mimeType: fullMime,
                        videoBitsPerSecond: 1_500_000,
                        audioBitsPerSecond: 96_000
                    });

                    sessionRecorderRef.current = sessionRecorder;
                    sessionRecordingUploadedRef.current = false;
                    const shouldStreamRecording = Boolean(candidateId && jobId);
                    recordingChunkedEnabledRef.current = shouldStreamRecording;
                    recordingSessionIdRef.current = shouldStreamRecording
                        ? createRecordingSessionId()
                        : null;
                    recordingChunkSeqRef.current = 0;
                    recordingUploadQueueRef.current = Promise.resolve();
                    sessionChunksRef.current = [];

                    sessionRecorder.ondataavailable = async (e) => {
                        if (e.data && e.data.size > 0) {
                            const seqNo = chunkSeqNoRef.current++;
                            const blob = e.data;

                            console.log(
                                `[RECORDING] Chunk ${seqNo} received, size: ${blob.size} bytes, type: ${blob.type}`
                            );

                            // Validate blob size - at least 10KB for valid 4s video segment
                            // BUT: If we haven't sent start time yet (likely Chunk 0), we MUST upload strictly to sync start time.
                            if (blob.size < 10000 && hasSentStartMsRef.current) {
                                console.error(
                                    `[RECORDING] Chunk ${seqNo} too small (${blob.size} bytes), skipping upload`
                                );
                                return;
                            }

                            // Validate blob type
                            if (!blob.type || !blob.type.includes("webm")) {
                                console.error(
                                    `[RECORDING] Chunk ${seqNo} invalid type: ${blob.type}, skipping upload`
                                );
                                return;
                            }

                            const now = Date.now();
                            const elapsedMs = now - recordingStartTimeLocalRef.current;
                            const chunkStartMs = lastChunkEndTimeRef.current;
                            const chunkEndMs = elapsedMs;
                            lastChunkEndTimeRef.current = elapsedMs;

                            // Upload chunk immediately - requestData() ensures it's finalized
                            uploadChunk(blob, userRole, seqNo, chunkStartMs, chunkEndMs).catch(
                                (err) => {
                                    console.error(
                                        `[RECORDING] Chunk ${seqNo} upload failed:`,
                                        err
                                    );
                                }
                            );
                        }
                    };

                    sessionRecorder.onerror = (e) => {
                        console.error(
                            "[RECORDING] Session recorder error:",
                            e.error
                        );
                    };

                    // Capture start time with server offset
                    trackStartMsRef.current = Date.now() + (serverTimeOffsetRef.current || 0);
                    recordingStartTimeLocalRef.current = Date.now();
                    lastChunkEndTimeRef.current = 0;
                    hasSentStartMsRef.current = false;
                    chunkSeqNoRef.current = 0; // Reset seqNo on new recording start
                    console.log(`[RECORDING] Recording started at ${trackStartMsRef.current} (offset: ${serverTimeOffsetRef.current})`);

                    // Start WITHOUT timeslice - we'll manually request data
                    // This ensures proper webm container finalization
                    sessionRecorder.start();
                    chunkUploadActiveRef.current = true;

                    // Manually request data every 4 seconds for proper chunk finalization
                    const chunkInterval = setInterval(() => {
                        if (sessionRecorder && sessionRecorder.state === 'recording') {
                            sessionRecorder.requestData();
                        } else {
                            clearInterval(chunkInterval);
                        }
                    }, 4000);

                    // Store interval ref for cleanup
                    if (!window.recordingChunkInterval) {
                        window.recordingChunkInterval = chunkInterval;
                    }

                    console.log("[RECORDING] Started recording with manual 4s chunk requests");
                } catch (err) {
                    console.error(
                        "[RECORDING] Failed to start session recorder:",
                        err
                    );
                }

                setMediaReady(true);
                console.log("[WebRTC] Media ready, connecting signaling...");
                connectSignaling();
            } catch (err) {
                console.error("[WebRTC] Failed to access camera/mic:", err);
                if (isAntiCheatEnabled && isCameraMandatory) {
                    registerAntiCheatViolation("CAMERA_TRACK_ENDED");
                    alert(
                        "Camera access is required for this interview. Please enable your camera and refresh the page."
                    );
                }
                setMediaReady(false);
            }
        };

        setupMedia();

        return () => {
            console.log("[WebRTC] Cleaning up media on unmount");
            const tracks = videoRef.current?.srcObject?.getTracks();
            tracks?.forEach((t) => t.stop());
            stopStreamTracks(userStreamRef.current);
            userStreamRef.current = null;

            if (canvasDrawIntervalRef.current) {
                clearInterval(canvasDrawIntervalRef.current);
                canvasDrawIntervalRef.current = null;
            }

            // Clean up recording chunk interval
            if (window.recordingChunkInterval) {
                clearInterval(window.recordingChunkInterval);
                window.recordingChunkInterval = null;
            }

            // canvasStreamRef removed - no longer using canvas recording

            if (lastAudioUrlRef.current) {
                URL.revokeObjectURL(lastAudioUrlRef.current);
            }

            try {
                const sr = sessionRecorderRef.current;
                if (sr && sr.state !== "inactive") {
                    sr.stop();
                }
            } catch {
                // ignore
            }

            if (sessionRecordingStopTimeoutRef.current) {
                clearTimeout(sessionRecordingStopTimeoutRef.current);
                sessionRecordingStopTimeoutRef.current = null;
            }

            try {
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
            } catch {
                // ignore
            }

            try {
                if (signalingRef.current) {
                    signalingRef.current.close();
                }
            } catch {
                // ignore
            }

            cleanupPeers();
        };
    }, [consentAccepted, isAntiCheatEnabled, isCameraMandatory]);

    useEffect(() => {
        // For Human / Human+AI interviewer types, start STT automatically
        // as soon as media is ready, and keep it running until the interview ends.
        if (consentAccepted && !isAIInterviewer && mediaReady && !isRecording) {
            console.log(
                "[WebRTC] Auto-starting continuous STT recording for Human/Human+AI interview"
            );
            startRecording();
        }
    }, [consentAccepted, isAIInterviewer, mediaReady, isRecording]);

    useEffect(() => {
        const handleUnload = () => {
            if (
                !interviewEndedRef.current &&
                isInterviewActiveRef.current &&
                (candidateId || jobId || interviewScheduleId)
            ) {
                let authToken = null;
                try {
                    authToken = getCookie("token") || localStorage.getItem("token");
                } catch {
                    authToken = null;
                }

                const payload = {
                    candidateId,
                    jobId,
                    interviewScheduleId,
                    ...(authToken ? { authToken } : {})
                };

                try {
                    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
                        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
                        navigator.sendBeacon("/api/ai/endInterview", blob);
                    }
                } catch (err) {
                    console.error("[WebRTC] beforeunload endInterview event failed:", err);
                }
            }
            hardCleanup();
        };
        window.addEventListener("beforeunload", handleUnload);
        return () => {
            window.removeEventListener("beforeunload", handleUnload);
        };
    }, []);

    useEffect(() => () => {
        hardCleanup();
    }, []);

    /* ============================
     *   AUDIO / TTS HELPERS
     * ============================
     */

    const blobToBase64 = (blob) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    const base64ToUint8 = (b64) => {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i) & 0xff;
        }
        return bytes;
    };

    const concatUint8 = (chunks) => {
        const total = chunks.reduce((sum, c) => sum + (c?.length || 0), 0);
        const out = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            if (!chunk?.length) continue;
            out.set(chunk, offset);
            offset += chunk.length;
        }
        return out;
    };

    const getSttWsUrl = () => {
        const envOrigin =
            import.meta.env?.VITE_BACKEND_ORIGIN ||
            import.meta.env?.VITE_API_ORIGIN ||
            "";

        const windowOrigin =
            typeof window !== "undefined" ? window.location.origin : "";

        let base = envOrigin || windowOrigin || "";

        // Dev fallback: if frontend is on 3000/5173, use backend 8080
        try {
            const url = new URL(base);
            if (["3000", "5173"].includes(url.port)) {
                url.port = "8080";
                base = url.toString().replace(/\/$/, "");
            }
        } catch {
            // ignore URL parsing failures
        }

        base = String(base || "").replace(/\/$/, "");
        const wsOrigin = base
            .replace(/^https:/i, "wss:")
            .replace(/^http:/i, "ws:");
        const token = getCookie("token") || localStorage.getItem("token") || "";
        const qs = token ? `?token=${encodeURIComponent(token)}` : "";
        return `${wsOrigin}/api/ai/transcribe/live${qs}`;
    };

    const wsSendJson = (ws, payload) => {
        try {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
            }
        } catch (err) {
            console.warn("[WebRTC] Failed to send WS payload:", err);
        }
    };

    const sanitizeWsUrlForLog = (url) => {
        if (!url) return url;
        const idx = url.indexOf("?");
        return idx === -1 ? url : url.slice(0, idx);
    };

    const handleSttWsMessage = async (payload) => {
        if (!payload || typeof payload !== "object") return;
        const type = payload.type;
        const turnId = payload.turnId;

        if (turnId && sttTurnIdRef.current && turnId !== sttTurnIdRef.current) {
            console.log("[WebRTC] Ignoring stale STT WS message:", type, turnId);
            return;
        }

        if (type === "ready") {
            console.log("[WebRTC] STT WS ready:", payload.sessionId);
            return;
        }

        if (type === "stt_open") {
            console.log("[WebRTC] Deepgram live stream opened");
            sttSendAllowedRef.current = true;
            return;
        }

        if (type === "log") {
            const level = (payload.level || "info").toLowerCase();
            const msg = payload.message || "";
            if (level === "error") console.error("[STT][WS]", msg, payload.data);
            else if (level === "warn") console.warn("[STT][WS]", msg, payload.data);
            else console.log("[STT][WS]", msg, payload.data);
            return;
        }

        if (type === "error") {
            console.error("[WebRTC] STT WS error:", payload.message || payload);
            return;
        }

        if (type === "stt") {
            if ((payload.text || "").trim()) {
                recordSilenceWatchActivity();
            }
            if (payload.isFinal) {
                sttPendingUserTextRef.current = payload.text || "";
            }
            console.log("[WebRTC] STT", payload.isFinal ? "(final)" : "(interim)", payload.text || "");
            return;
        }

        if (type === "stt_final") {
            const finalText = (payload.text || "").trim();
            sttPendingUserTextRef.current = finalText;
            if (finalText) {
                recordSilenceWatchActivity();
            }
            console.log("[WebRTC] STT final:", sttPendingUserTextRef.current);
            if (!isAIInterviewer && finalText) {
                setConversation((prev) => [
                    ...prev,
                    { user: finalText, ai: null }
                ]);
                const { senderName, senderRole } = getLocalHumanChatSender();
                broadcastTranscriptEntry(finalText, senderName, senderRole);
                sttPendingUserTextRef.current = "";
            }
            return;
        }

        if (type === "ai_text") {
            const userText = sttPendingUserTextRef.current || "";
            const aiText = payload.text || "";
            if (aiText) {
                stopSilenceWatch({ resetPromptCount: true });
            }
            if (userText || aiText) {
                console.log("[WebRTC] AI text received", {
                    userChars: userText?.length || 0,
                    aiChars: aiText?.length || 0
                });
                pendingAiResponseRef.current = {
                    userText: userText || null,
                    aiText: aiText || null
                };
                if (pendingAiFlushTimeoutRef.current) {
                    clearTimeout(pendingAiFlushTimeoutRef.current);
                }
                pendingAiFlushTimeoutRef.current = setTimeout(() => {
                    flushPendingAiResponse();
                }, 1500);
            }
            sttPendingUserTextRef.current = "";
            return;
        }

        if (type === "audio_start") {
            stopSilenceWatch({ resetPromptCount: false });
            sttAudioChunksRef.current = [];
            sttAudioContentTypeRef.current = payload.contentType || "audio/mpeg";
            ttsChunkCountRef.current = 0;
            if (audioRef.current) {
                stopAIAudio();
            }
            flushPendingAiResponse();
            console.log("[WebRTC] TTS audio_start", {
                contentType: sttAudioContentTypeRef.current
            });
            startTtsStreamPlayback(sttAudioContentTypeRef.current);
            return;
        }

        if (type === "audio_chunk") {
            if (payload.audioBase64) {
                const chunk = base64ToUint8(payload.audioBase64);
                ttsChunkCountRef.current += 1;
                if (ttsChunkCountRef.current === 1 || ttsChunkCountRef.current % 20 === 0) {
                    console.log("[WebRTC] TTS audio_chunk", {
                        seq: payload.seq,
                        chunks: ttsChunkCountRef.current,
                        streaming: ttsStreamRef.current.active
                    });
                }
                if (ttsStreamRef.current.active) {
                    ttsStreamRef.current.queue.push(chunk);
                    appendNextTtsChunk();
                } else {
                    sttAudioChunksRef.current.push(chunk);
                }
            }
            return;
        }

        if (type === "audio_end") {
            flushPendingAiResponse();
            if (ttsStreamRef.current.active) {
                ttsStreamRef.current.pendingEnd = true;
                appendNextTtsChunk();
                console.log("[WebRTC] TTS audio_end (streaming)", {
                    chunks: ttsChunkCountRef.current
                });
            } else {
                const merged = concatUint8(sttAudioChunksRef.current);
                sttAudioChunksRef.current = [];
                if (merged.length > 0) {
                    console.log("[WebRTC] TTS audio_end (buffered)", {
                        chunks: ttsChunkCountRef.current,
                        bytes: merged.length
                    });
                    await playAudioSmart(merged.buffer, sttAudioContentTypeRef.current);
                } else {
                    console.warn("[WebRTC] audio_end received but no audio chunks");
                }
            }
            scheduleSilenceWatch({ resetPromptCount: false });
            return;
        }
    };

    const waitForWsOpen = (ws, timeoutMs = 8000) =>
        new Promise((resolve, reject) => {
            let settled = false;
            let timeoutId = null;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                ws.removeEventListener("open", onOpen);
                ws.removeEventListener("error", onError);
                ws.removeEventListener("close", onClose);
            };

            const finishResolve = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(ws);
            };

            const finishReject = (message) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new Error(message));
            };

            const onOpen = () => finishResolve();
            const onError = () =>
                finishReject("Live transcription connection failed. Please check your network and retry.");
            const onClose = (event) =>
                finishReject(
                    `Live transcription connection closed before start (code: ${event?.code || "unknown"}).`
                );

            timeoutId = setTimeout(() => {
                finishReject("Live transcription connection timed out. Please retry.");
                try {
                    ws.close();
                } catch {
                    // ignore
                }
            }, timeoutMs);

            ws.addEventListener("open", onOpen);
            ws.addEventListener("error", onError);
            ws.addEventListener("close", onClose);
        });

    const ensureSttWs = async ({ timeoutMs = 8000 } = {}) => {
        const existing = sttWsRef.current;
        if (existing && existing.readyState === WebSocket.OPEN) {
            return existing;
        }

        if (existing && existing.readyState === WebSocket.CONNECTING) {
            return waitForWsOpen(existing, timeoutMs);
        }

        const url = getSttWsUrl();
        if (!url.includes("token=")) {
            console.warn("[WebRTC] STT WS connecting without auth token; expected 401 if backend requires auth.");
        }
        console.log("[WebRTC] Connecting STT WS:", sanitizeWsUrlForLog(url));

        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        sttWsRef.current = ws;

        ws.onmessage = async (event) => {
            if (typeof event.data !== "string") return;
            try {
                const payload = JSON.parse(event.data);
                await handleSttWsMessage(payload);
            } catch (err) {
                console.warn("[WebRTC] STT WS invalid message:", err);
            }
        };
        ws.onclose = (ev) => {
            console.warn("[WebRTC] STT WS closed:", ev.code, ev.reason);
            if (sttWsRef.current === ws) sttWsRef.current = null;
        };
        ws.onerror = (err) => {
            console.error("[WebRTC] STT WS error:", err);
        };

        try {
            const connected = await waitForWsOpen(ws, timeoutMs);
            console.log("[WebRTC] STT WS connected");
            return connected;
        } catch (err) {
            if (sttWsRef.current === ws) sttWsRef.current = null;
            throw err;
        }
    };

    const floatTo16BitPCM = (float32Array) => {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < float32Array.length; i++) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
        return buffer;
    };

    const startSttCapture = async () => {
        if (sttCaptureActiveRef.current) {
            return sttAudioCtxRef.current?.sampleRate || 16000;
        }

        const stream = userStreamRef.current;
        if (!stream) {
            console.warn("[WebRTC] STT capture failed: no user stream");
            return null;
        }

        const audioTracks = stream.getAudioTracks().filter((t) => t.readyState === "live");
        if (!audioTracks.length) {
            console.warn("[WebRTC] STT capture failed: no live audio tracks");
            return null;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 16000 });
        if (ctx.state === "suspended") {
            try {
                await ctx.resume();
            } catch {
                // ignore resume errors
            }
        }
        const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const zeroGain = ctx.createGain();
        zeroGain.gain.value = 0;

        source.connect(processor);
        processor.connect(zeroGain);
        zeroGain.connect(ctx.destination);

        processor.onaudioprocess = (e) => {
            if (!sttCaptureActiveRef.current) return;
            if (!sttSendAllowedRef.current) return;
            const ws = sttWsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            const input = e.inputBuffer.getChannelData(0);
            const pcm = floatTo16BitPCM(input);
            try {
                ws.send(pcm);
            } catch (err) {
                console.warn("[WebRTC] Failed to send STT audio chunk:", err);
            }
        };

        sttAudioCtxRef.current = ctx;
        sttSourceRef.current = source;
        sttProcessorRef.current = processor;
        sttZeroGainRef.current = zeroGain;
        sttCaptureActiveRef.current = true;

        console.log("[WebRTC] STT capture started, sampleRate:", ctx.sampleRate);
        return ctx.sampleRate;
    };

    const stopSttCapture = () => {
        sttCaptureActiveRef.current = false;
        sttSendAllowedRef.current = false;

        try {
            sttProcessorRef.current?.disconnect();
        } catch {
            // ignore
        }
        try {
            sttSourceRef.current?.disconnect();
        } catch {
            // ignore
        }
        try {
            sttZeroGainRef.current?.disconnect();
        } catch {
            // ignore
        }
        try {
            sttAudioCtxRef.current?.close();
        } catch {
            // ignore
        }

        sttProcessorRef.current = null;
        sttSourceRef.current = null;
        sttZeroGainRef.current = null;
        sttAudioCtxRef.current = null;
        console.log("[WebRTC] STT capture stopped");
    };

    const normalizeMime = (raw) => {
        const ct = (raw || "").toLowerCase();

        if (ct.includes("mpeg") || ct.includes("mp3")) return "audio/mpeg";
        if (ct.includes("wav")) return "audio/wav";
        if (ct.includes("ogg")) return "audio/ogg";
        if (ct.includes("webm")) return "audio/webm";

        return "audio/mpeg";
    };

    const flushPendingAiResponse = () => {
        if (pendingAiFlushTimeoutRef.current) {
            clearTimeout(pendingAiFlushTimeoutRef.current);
            pendingAiFlushTimeoutRef.current = null;
        }
        const pending = pendingAiResponseRef.current;
        if (!pending) return;
        console.log("[WebRTC] Flushing pending AI text", {
            hasUser: !!pending.userText,
            aiChars: pending.aiText?.length || 0
        });
        setConversation((prev) => [
            ...prev,
            { user: pending.userText || null, ai: pending.aiText || null }
        ]);
        pendingAiResponseRef.current = null;
    };

    const cleanupTtsStream = () => {
        const state = ttsStreamRef.current;
        if (state?.objectUrl) {
            try {
                URL.revokeObjectURL(state.objectUrl);
            } catch {
                // ignore
            }
        }
        ttsStreamRef.current = {
            mediaSource: null,
            sourceBuffer: null,
            queue: [],
            pendingEnd: false,
            objectUrl: null,
            mime: "audio/mpeg",
            active: false
        };
    };

    const appendNextTtsChunk = () => {
        const state = ttsStreamRef.current;
        if (!state.active || !state.sourceBuffer || state.sourceBuffer.updating) return;

        const next = state.queue.shift();
        if (next) {
            try {
                state.sourceBuffer.appendBuffer(next);
            } catch (err) {
                console.warn("[WebRTC] Failed to append TTS chunk:", err);
            }
            return;
        }

        if (state.pendingEnd && state.mediaSource?.readyState === "open") {
            try {
                state.mediaSource.endOfStream();
            } catch {
                // ignore
            }
            state.pendingEnd = false;
        }
    };

    const startTtsStreamPlayback = async (contentType) => {
        const mime = normalizeMime(contentType);
        if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported(mime)) {
            console.warn("[WebRTC] MediaSource not supported for", mime, "falling back to buffered playback");
            return false;
        }

        cleanupTtsStream();

        if (lastAudioUrlRef.current) {
            try {
                URL.revokeObjectURL(lastAudioUrlRef.current);
            } catch {
                // ignore
            }
            lastAudioUrlRef.current = null;
        }

        const mediaSource = new MediaSource();
        const objectUrl = URL.createObjectURL(mediaSource);
        lastAudioUrlRef.current = objectUrl;

        const audio = new Audio(objectUrl);
        audio.playbackRate = slowModeRef.current ? 0.85 : 1;
        audioRef.current = audio;

        try {
            const ctx = audioContextRef.current;
            const mixDest = mixDestRef.current;

            if (ctx && mixDest) {
                if (ctx.state === "suspended") {
                    await ctx.resume().catch(() => { });
                }

                const sourceNode = ctx.createMediaElementSource(audio);
                sourceNode.connect(ctx.destination);
                sourceNode.connect(mixDest);
                if (recordingMixDestRef.current) {
                    sourceNode.connect(recordingMixDestRef.current);
                }
            }
        } catch (err) {
            console.warn("[WebRTC] Failed to route streamed TTS audio into mix:", err);
        }

        ttsStreamRef.current = {
            mediaSource,
            sourceBuffer: null,
            queue: [],
            pendingEnd: false,
            objectUrl,
            mime,
            active: true
        };

        mediaSource.addEventListener("sourceopen", () => {
            const state = ttsStreamRef.current;
            if (!state.active || state.sourceBuffer) return;
            try {
                const sb = mediaSource.addSourceBuffer(mime);
                sb.mode = "sequence";
                state.sourceBuffer = sb;
                sb.addEventListener("updateend", appendNextTtsChunk);
                appendNextTtsChunk();
                console.log("[WebRTC] TTS stream source buffer ready", mime);
            } catch (err) {
                console.warn("[WebRTC] Failed to init TTS source buffer:", err);
                state.active = false;
            }
        }, { once: true });

        audio.addEventListener("play", () => {
            stopSilenceWatch({ resetPromptCount: false });
            aiSpeakingRef.current = true;
            setAiSpeaking(true);
        });
        audio.addEventListener("ended", () => {
            aiSpeakingRef.current = false;
            setAiSpeaking(false);
            scheduleSilenceWatch({ resetPromptCount: false });
        });

        if (!isInterviewPausedRef.current) {
            audio.play().catch(() => {
                // ignore autoplay errors
            });
        }

        return true;
    };

    const playAudioSmart = async (arrayBuffer, contentType) => {
        if (interviewEndedRef.current) return;
        if (isInterviewPausedRef.current) {
            pendingAudioRef.current = { arrayBuffer, contentType };
            return;
        }
        if (isAIInterviewer && isRecordingRef.current) {
            stopAIAudio();
            console.log(
                "[WebRTC] Skipping AI audio playback while user is answering"
            );
            return;
        }
        const mime = normalizeMime(contentType);

        if (lastAudioUrlRef.current) {
            URL.revokeObjectURL(lastAudioUrlRef.current);
            lastAudioUrlRef.current = null;
        }

        try {
            const blob = new Blob([new Uint8Array(arrayBuffer)], {
                type: mime
            });
            const url = URL.createObjectURL(blob);
            lastAudioUrlRef.current = url;

            const audio = new Audio(url);
            audio.playbackRate = slowModeRef.current ? 0.85 : 1;
            audioRef.current = audio;

            try {
                const ctx = audioContextRef.current;
                const mixDest = mixDestRef.current;

                if (ctx && mixDest) {
                    // Resume AudioContext if suspended (browser autoplay policy)
                    if (ctx.state === "suspended") {
                        await ctx.resume().catch(() => { });
                    }

                    // Check if audio element already connected to avoid DOMException
                    // "The HTMLMediaElement is already connected to this AudioContext"
                    if (!audio._mediaElementSource) {
                        const sourceNode = ctx.createMediaElementSource(audio);
                        sourceNode.connect(ctx.destination); // For playback
                        sourceNode.connect(mixDest);         // For recording (mixed audio)
                        if (recordingMixDestRef.current) {
                            sourceNode.connect(recordingMixDestRef.current);
                        }
                        audio._mediaElementSource = sourceNode;
                        console.log("[WebRTC] AI audio connected to mix for recording");
                    } else {
                        // Audio element already has source node, just ensure connections
                        audio._mediaElementSource.connect(ctx.destination);
                        audio._mediaElementSource.connect(mixDest);
                        if (recordingMixDestRef.current) {
                            audio._mediaElementSource.connect(recordingMixDestRef.current);
                        }
                        console.log("[WebRTC] AI audio reconnected to mix");
                    }
                }
            } catch (err) {
                // Handle InvalidStateError gracefully
                if (err.name === "InvalidStateError" || err.name === "NotSupportedError") {
                    console.warn(
                        "[WebRTC] Audio element already connected or not supported:",
                        err.message
                    );
                } else {
                    console.warn("[WebRTC] Failed to route AI audio into mix:", err);
                }
            }

            if (interviewEndedRef.current) return;
            stopSilenceWatch({ resetPromptCount: false });
            aiSpeakingRef.current = true;
            setAiSpeaking(true);
            console.log("[WebRTC] Playing AI audio...");
            await audio.play();

            audio.onended = () => {
                aiSpeakingRef.current = false;
                setAiSpeaking(false);
                scheduleSilenceWatch({ resetPromptCount: false });
                console.log("[WebRTC] AI audio ended");
            };
        } catch (err) {
            console.error("[WebRTC] playAudioSmart error:", err);
            aiSpeakingRef.current = false;
            setAiSpeaking(false);
        }
    };

    const stopAIAudio = () => {
        if (audioRef.current) {
            console.log("[WebRTC] Stopping AI audio playback");
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        cleanupTtsStream();
        aiSpeakingRef.current = false;
        setAiSpeaking(false);
    };

    const flashQuickAction = (action) => {
        setClickedAction(action);
        window.setTimeout(() => {
            setClickedAction((prev) => (prev === action ? null : prev));
        }, 250);
    };

    const clearSilenceTimer = () => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    };

    const stopSilenceWatch = ({ resetPromptCount = false } = {}) => {
        clearSilenceTimer();
        silenceWatchActiveRef.current = false;
        silencePromptInFlightRef.current = false;
        if (resetPromptCount) {
            silencePromptCountRef.current = 0;
        }
    };

    const scheduleSilenceWatch = ({ resetPromptCount = false } = {}) => {
        if (!isAIInterviewer || isCodingRound) return;
        if (interviewEndedRef.current || !isInterviewActiveRef.current) return;
        if (isInterviewPausedRef.current) return;
        if (aiSpeakingRef.current) return;

        if (resetPromptCount) {
            silencePromptCountRef.current = 0;
        }

        silenceWatchActiveRef.current = true;
        clearSilenceTimer();
        silenceTimerRef.current = window.setTimeout(() => {
            void handleSilenceTimeout();
        }, SILENCE_TIMEOUT_MS);
    };

    const recordSilenceWatchActivity = () => {
        if (!silenceWatchActiveRef.current) return;
        scheduleSilenceWatch({ resetPromptCount: true });
    };

    const playSilencePrompt = async () => {
        if (interviewEndedRef.current) return;
        const promptText = "Are you still there?";

        setConversation((prev) => [
            ...prev,
            { user: null, ai: promptText, meta: { isSilencePrompt: true } }
        ]);

        const jwt = localStorage.getItem("token") || "";
        const csrf = document.cookie
            .split(";")
            .map((x) => x.trim())
            .find((c) => c.startsWith("csrftoken="))
            ?.split("=")[1];

        const speakRes = await fetch("/api/ai/speak", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(jwt && {
                    Authorization: `Bearer ${jwt}`
                }),
                ...(csrf && {
                    "x-csrf-token": csrf
                })
            },
            credentials: "include",
            body: JSON.stringify({
                text: promptText
            })
        });

        if (interviewEndedRef.current) return;
        const contentType = speakRes.headers.get("content-type") || "audio/mpeg";
        const audioBuffer = await speakRes.arrayBuffer();
        if (interviewEndedRef.current) return;
        await playAudioSmart(audioBuffer, contentType);
    };

    const handleSilenceTimeout = async () => {
        if (!silenceWatchActiveRef.current) return;
        if (!isAIInterviewer || isCodingRound) return;
        if (interviewEndedRef.current || !isInterviewActiveRef.current) return;
        if (isInterviewPausedRef.current) return;
        if (silencePromptInFlightRef.current) return;

        clearSilenceTimer();
        silencePromptInFlightRef.current = true;

        try {
            if (silencePromptCountRef.current >= SILENCE_PROMPT_LIMIT) {
                stopSilenceWatch({ resetPromptCount: true });
                void handleConfirmEnd();
                return;
            }

            silencePromptCountRef.current += 1;

            if (isRecordingRef.current) {
                stopRecording();
            }
            stopAIAudio();
            await playSilencePrompt();
        } catch (err) {
            console.error("[WebRTC] Silence prompt failed:", err);
        } finally {
            silencePromptInFlightRef.current = false;
            if (
                !interviewEndedRef.current &&
                isInterviewActiveRef.current &&
                !isInterviewPausedRef.current
            ) {
                scheduleSilenceWatch({ resetPromptCount: false });
            }
        }
    };

    const pauseInterview = () => {
        if (interviewEndedRef.current || !isInterviewActive) return;
        if (isInterviewPausedRef.current) return;
        isInterviewPausedRef.current = true;
        setIsInterviewPaused(true);
        clearInterval(timerRef.current);

        if (isRecordingRef.current) {
            stopRecording();
        }
        stopSilenceWatch({ resetPromptCount: false });

        const sr = sessionRecorderRef.current;
        if (sr && sr.state === "recording") {
            try {
                sr.pause();
            } catch {
                // ignore
            }
        }

        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
        }
        setAiSpeaking(false);
    };

    const resumeInterview = async () => {
        if (interviewEndedRef.current || !isInterviewPausedRef.current) return;
        isInterviewPausedRef.current = false;
        setIsInterviewPaused(false);

        if (consentAccepted) {
            startCallTimer();
        }

        const sr = sessionRecorderRef.current;
        if (sr && sr.state === "paused") {
            try {
                sr.resume();
            } catch {
                // ignore
            }
        }

        const pending = pendingAudioRef.current;
        if (pending) {
            pendingAudioRef.current = null;
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setAiSpeaking(false);
            await playAudioSmart(pending.arrayBuffer, pending.contentType);
            return;
        }

        if (audioRef.current && audioRef.current.paused) {
            audioRef.current.playbackRate = slowModeRef.current ? 0.85 : 1;
            try {
                setAiSpeaking(true);
                await audioRef.current.play();
            } catch {
                setAiSpeaking(false);
            }
        }

        if (!isRecordingRef.current && !aiSpeaking) {
            scheduleSilenceWatch({ resetPromptCount: false });
        }
    };

    const handleRepeatQuestion = async () => {
        if (interviewEndedRef.current || !lastAiPrompt || isInterviewPausedRef.current) return;
        flashQuickAction("repeat");
        stopSilenceWatch({ resetPromptCount: true });

        const jwt = localStorage.getItem("token") || "";
        const csrf = document.cookie
            .split(";")
            .map((x) => x.trim())
            .find((c) => c.startsWith("csrftoken="))
            ?.split("=")[1];

        try {
            stopAIAudio();
            const speakRes = await fetch("/api/ai/speak", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(jwt && {
                        Authorization: `Bearer ${jwt}`
                    }),
                    ...(csrf && {
                        "x-csrf-token": csrf
                    })
                },
                credentials: "include",
                body: JSON.stringify({
                    text: lastAiPrompt
                })
            });

            if (interviewEndedRef.current) return;
            const contentType =
                speakRes.headers.get("content-type") || "audio/mpeg";
            const audioBuffer = await speakRes.arrayBuffer();
            if (interviewEndedRef.current) return;

            await playAudioSmart(audioBuffer, contentType);
        } catch (err) {
            console.error("[WebRTC] Failed to repeat question:", err);
        }
    };

    const handlePauseQuestion = () => {
        pauseInterview();
    };

    const handleSlowDownQuestion = () => {
        flashQuickAction("slow");
        setIsSlowMode((prev) => {
            const next = !prev;
            slowModeRef.current = next;
            if (audioRef.current) {
                audioRef.current.playbackRate = next ? 0.85 : 1;
            }
            return next;
        });
    };

    const speakGreeting = async () => {
        // Disable greeting for Coding rounds (user starts manually / reads instructions)
        if (scriptMeta.roundType === 'Coding') return;

        if (interviewEndedRef.current) return;
        if (!isAIInterviewer || greetingPlayedRef.current) return;

        greetingPlayedRef.current = true;

        const candidateName = scriptMeta.candidateName
            ? ` ${scriptMeta.candidateName}`
            : "";
        const jobTitle = scriptMeta.jobTitle
            ? ` for the ${scriptMeta.jobTitle} role`
            : "";
        const greetingText = `Hello ${candidateName}. Welcome ${jobTitle} interview. I'm Layla, your AI interviewer. I'll be guiding you through today's interview.
        Please note: that the audio and video of this interview will be recorded exclusively for recruitment purposes only. If you do not agree, please click "End Interview" to exit. If you are okay with this, click "Start Answering" and then say "I'm ready."
        Once you begin, I will ask a few short questions.`; setConversation((prev) => {
            if (prev.some((entry) => entry?.meta?.isGreeting)) return prev;
            return [
                ...prev,
                { user: null, ai: greetingText, meta: { isGreeting: true } },
            ];
        });

        const jwt = localStorage.getItem("token") || "";
        const csrf = document.cookie
            .split(";")
            .map((x) => x.trim())
            .find((c) => c.startsWith("csrftoken="))
            ?.split("=")[1];

        try {
            console.log("[WebRTC] Playing AI greeting message");
            const speakRes = await fetch("/api/ai/speak", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(jwt && {
                        Authorization: `Bearer ${jwt}`
                    }),
                    ...(csrf && {
                        "x-csrf-token": csrf
                    })
                },
                credentials: "include",
                body: JSON.stringify({
                    text: greetingText
                })
            });

            if (interviewEndedRef.current) return;
            const contentType =
                speakRes.headers.get("content-type") || "audio/mpeg";
            const audioBuffer = await speakRes.arrayBuffer();
            if (interviewEndedRef.current) return;
            await playAudioSmart(audioBuffer, contentType);
        } catch (err) {
            console.error("[WebRTC] Failed to play greeting audio:", err);
        }
    };

    /* ============================
     *   AI / HUMAN ANSWER PIPELINE
     * ============================
     */

    const startRecording = async () => {
        if (startRecordingBusy) return;

        setStartRecordingBusy(true);
        setStartRecordingError("");

        try {
            if (!consentAccepted) {
                console.warn("[WebRTC] startRecording blocked until consent is accepted");
                setStartRecordingError("Please accept consent before starting your answer.");
                return;
            }
            if (!isInterviewActive || interviewEndedRef.current) {
                console.warn("[WebRTC] startRecording blocked because interview ended");
                setStartRecordingError("Interview is not active. Refresh and rejoin the interview.");
                return;
            }
            if (isInterviewPausedRef.current) {
                console.warn("[WebRTC] startRecording blocked because interview is paused");
                setStartRecordingError("Interview is paused. Resume it before answering.");
                return;
            }
            if (!mediaReady || isRecording) {
                console.log(
                    "[WebRTC] startRecording ignored – mediaReady:",
                    mediaReady,
                    "isRecording:",
                    isRecording
                );
                if (!mediaReady) {
                    setStartRecordingError("Camera and microphone are not ready yet. Please wait a moment.");
                }
                return;
            }
            if (isAIInterviewer && (aiSpeaking || audioRef.current)) {
                stopAIAudio();
            }

            // HARD-GUARD: if camera is mandatory but not live/visible, block answering.
            if (isAntiCheatEnabled && isCameraMandatory) {
                const mixed = mixedStreamRef.current;
                const videoTracks = mixed?.getVideoTracks() || [];
                const activeTrack = videoTracks[0];
                const videoEl = videoRef.current;

                const invalid =
                    !activeTrack ||
                    activeTrack.readyState !== "live" ||
                    activeTrack.enabled === false ||
                    activeTrack.muted === true ||
                    !videoEl ||
                    videoEl.videoWidth === 0 ||
                    videoEl.videoHeight === 0 ||
                    videoEl.readyState < 2;

                if (invalid) {
                    const message = "Camera must be on and clearly showing you to start answering.";
                    console.warn(
                        "[AntiCheat] Attempt to start recording without active camera while cameraRequired=true"
                    );
                    registerAntiCheatViolation("CAMERA_TRACK_ENDED");
                    setStartRecordingError(message);
                    alert(message);
                    return;
                }
            }

            const stream = mixedStreamRef.current || videoRef.current?.srcObject;
            if (!stream) {
                console.warn(
                    "[WebRTC] No stream for per-answer / continuous recorder"
                );
                setStartRecordingError("Interview media stream is unavailable. Reload and try again.");
                return;
            }

            const audioTracksBase = stream.getAudioTracks();
            if (!audioTracksBase.length) {
                console.warn(
                    "[WebRTC] [HumanMode] No audio tracks available for recording; aborting startRecording"
                );
                setStartRecordingError("Microphone audio is not available. Check mic permissions and device.");
                return;
            }

            const audioStreamBase = new MediaStream(audioTracksBase);
            const mimeType = MediaRecorder.isTypeSupported(
                "audio/webm;codecs=opus"
            )
                ? "audio/webm;codecs=opus"
                : "audio/webm";

            const useLiveStt = true;
            if (useLiveStt) {
                console.log(
                    `[WebRTC] startRecording – Live STT (${isAIInterviewer ? "AI" : "Human"})`
                );

                try {
                    const ws = await ensureSttWs();
                    if (!ws) {
                        console.warn("[WebRTC] STT WS not available");
                        setStartRecordingError("Live transcription service is unavailable. Please retry.");
                    } else {
                        const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        sttTurnIdRef.current = turnId;
                        sttPendingUserTextRef.current = "";
                        sttSendAllowedRef.current = false;

                        const sampleRate = await startSttCapture();
                        if (!sampleRate) {
                            console.warn("[WebRTC] STT capture failed; aborting start");
                            setStartRecordingError("Unable to capture microphone audio. Please re-check permissions.");
                        } else {
                            const sttLanguage = isAIInterviewer ? "en" : "multi";
                            wsSendJson(ws, {
                                type: "start",
                                turnId,
                                candidateId,
                                jobId,
                                interviewScheduleId,
                                jobTitle: scriptMeta.jobTitle,
                                candidateName: scriptMeta.candidateName,
                                technicalScript: scriptMeta.technicalScript,
                                sampleRate,
                                encoding: "linear16",
                                sttLanguage,
                                disableAI: !isAIInterviewer,
                                mode: isAIInterviewer ? "ai_interview" : "transcribe_only"
                            });

                            setRecording(true);
                            isRecordingRef.current = true;
                            recordSilenceWatchActivity();
                            if (!isAIInterviewer) {
                                if (recordingStopTimeoutRef.current) {
                                    clearTimeout(recordingStopTimeoutRef.current);
                                }
                                recordingStopTimeoutRef.current = window.setTimeout(() => {
                                    stopRecording();
                                }, RECORDING_DURATION_MS);
                            }
                            return;
                        }
                    }
                } catch (err) {
                    console.error("[WebRTC] Failed to start live STT:", err);
                    setStartRecordingError(
                        err?.message || "Unable to start live transcription. Please retry."
                    );
                }
            }

            if (!isAIInterviewer) {
                // fallback continuous STT flow for Human / Human+AI
                console.log(
                    "[WebRTC] startRecording – Human/Human+AI fallback (looped 10s STT chunks)"
                );

                const loopRecordChunk = () => {
                    if (!isRecordingRef.current) {
                        console.log(
                            "[WebRTC] [HumanMode] Recording flag false, stopping STT loop"
                        );
                        return;
                    }

                    const baseTracks = audioStreamBase
                        .getAudioTracks()
                        .filter((t) => t.readyState === "live");

                    if (!baseTracks.length) {
                        console.warn(
                            "[WebRTC] [HumanMode] No live audio tracks; stopping STT loop"
                        );
                        isRecordingRef.current = false;
                        setRecording(false);
                        return;
                    }

                    const freshStream = new MediaStream(baseTracks);
                    let localChunks = [];
                    const startTs = Date.now();

                    let recorder;
                    try {
                        recorder = new MediaRecorder(freshStream, {
                            mimeType,
                            audioBitsPerSecond: 128000
                        });
                    } catch (err) {
                        console.error(
                            "[WebRTC] [HumanMode] Failed to create MediaRecorder:",
                            err
                        );
                        isRecordingRef.current = false;
                        setRecording(false);
                        return;
                    }

                    recorderRef.current = recorder;

                    recorder.ondataavailable = (e) => {
                        if (e.data && e.data.size > 0) {
                            localChunks.push(e.data);
                        }
                    };

                    recorder.onerror = (e) => {
                        console.error(
                            "[WebRTC] [HumanMode] MediaRecorder error:",
                            e.error || e
                        );
                    };

                    recorder.onstop = async () => {
                        try {
                            if (isInterviewPausedRef.current) {
                                console.log("[WebRTC] Recording stopped during pause, skipping human STT chunk");
                                return;
                            }
                            const elapsed = Date.now() - startTs;
                            const chunkBlob = new Blob(localChunks, {
                                type: mimeType
                            });

                            if (
                                elapsed < MIN_DURATION_MS &&
                                chunkBlob.size < 1500
                            ) {
                                console.warn(
                                    "[WebRTC] [HumanMode] Ignoring very short STT chunk",
                                    { elapsed, size: chunkBlob.size }
                                );
                            } else {
                                try {
                                    const base64Audio =
                                        await blobToBase64(chunkBlob);
                                    console.log(
                                        "[WebRTC] [HumanMode] Sending continuous chunk to /api/ai/transcribe..."
                                    );
                                    const data = await fetchData(
                                        "/api/ai/transcribe",
                                        {
                                            method: "POST",
                                            body: {
                                                audioData: base64Audio,
                                                candidateId,
                                                jobId,
                                                interviewScheduleId,
                                                sttLanguage: "multi"
                                            }
                                        }
                                    );

                                    const userText = (data?.text || "").trim();
                                    if (!userText) {
                                        console.warn(
                                            "[WebRTC] [HumanMode] Empty STT text for chunk, skipping"
                                        );
                                    } else {
                                        console.log(
                                            "[WebRTC] [HumanMode] STT chunk text:",
                                            userText
                                        );

                                        setConversation((prev) => [
                                            ...prev,
                                            { user: userText, ai: null }
                                        ]);
                                        const { senderName, senderRole } = getLocalHumanChatSender();
                                        broadcastTranscriptEntry(userText, senderName, senderRole);
                                    }
                                } catch (err) {
                                    console.error(
                                        "[WebRTC] [HumanMode] Continuous STT error:",
                                        err
                                    );
                                }
                            }
                        } finally {
                            if (isRecordingRef.current && !isAIInterviewer) {
                                loopRecordChunk();
                            }
                        }
                    };

                    recorder.start();

                    setTimeout(() => {
                        try {
                            if (recorder.state === "recording") {
                                recorder.stop();
                            }
                        } catch {
                            // ignore
                        }
                    }, 10000);
                };

                setRecording(true);
                isRecordingRef.current = true;
                if (recordingStopTimeoutRef.current) {
                    clearTimeout(recordingStopTimeoutRef.current);
                }
                recordingStopTimeoutRef.current = window.setTimeout(() => {
                    stopRecording();
                }, RECORDING_DURATION_MS);
                loopRecordChunk();
                return;
            }

            setStartRecordingError((prev) =>
                prev || "Unable to start answering right now. Please try again."
            );
        } finally {
            setStartRecordingBusy(false);
        }
    };

    const stopRecording = () => {
        if (recordingStopTimeoutRef.current) {
            clearTimeout(recordingStopTimeoutRef.current);
            recordingStopTimeoutRef.current = null;
        }
        if (isAIInterviewer) {
            stopSilenceWatch({ resetPromptCount: false });
        }

        const ws = sttWsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN && sttTurnIdRef.current) {
            wsSendJson(ws, { type: "stop", turnId: sttTurnIdRef.current });
        }
        stopSttCapture();

        const recorder = recorderRef.current;
        if (recorder && recorder.state === "recording") {
            console.log("[WebRTC] Stopping recorder...");
            try {
                recorder.stop();
            } catch {
                // ignore
            }
        }
        setRecording(false);
        isRecordingRef.current = false;
    };

    /* ============================
     *   SESSION RECORDING HELPERS
     * ============================
     */

    const createRecordingSessionId = () => {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    };

    const enqueueRecordingChunkUpload = (blob, { isFinal = false } = {}) => {
        if (!recordingChunkedEnabledRef.current) return Promise.resolve(null);
        if (!candidateId || !jobId) return Promise.resolve(null);

        if (!recordingSessionIdRef.current) {
            recordingSessionIdRef.current = createRecordingSessionId();
        }

        const sessionId = recordingSessionIdRef.current;
        const chunkIndex = recordingChunkSeqRef.current++;
        const contentType = blob?.type || "video/webm";

        const uploadChunk = async () => {
            const base64 = blob ? await blobToBase64(blob) : "";
            return fetchData("/api/ai/saveRecordingChunk", {
                method: "POST",
                body: {
                    sessionId,
                    chunkIndex,
                    chunkData: base64,
                    candidateId,
                    jobId,
                    interviewScheduleId,
                    contentType,
                    isFinal
                }
            });
        };

        recordingUploadQueueRef.current = recordingUploadQueueRef.current
            .then(uploadChunk)
            .catch((err) => {
                console.error("[WebRTC] Recording chunk upload failed:", err);
            });

        return recordingUploadQueueRef.current;
    };

    const finalizeServerRecording = async () => {
        if (!recordingChunkedEnabledRef.current) return null;
        if (sessionRecordingUploadedRef.current) return null;
        if (!recordingSessionIdRef.current) return null;

        try {
            const sr = sessionRecorderRef.current;
            if (sr && sr.state !== "inactive") {
                try {
                    sr.stop();
                } catch {
                    // ignore
                }
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
            await recordingUploadQueueRef.current;
        } catch {
            // ignore queue errors
        }

        try {
            const res = await fetchData("/api/ai/saveRecordingChunk", {
                method: "POST",
                body: {
                    sessionId: recordingSessionIdRef.current,
                    candidateId,
                    jobId,
                    interviewScheduleId,
                    isFinal: true
                }
            });
            if (res?.url) {
                sessionRecordingUploadedRef.current = true;
            }
            return res?.url || null;
        } catch (err) {
            console.error("[WebRTC] Failed to finalize server recording:", err);
            return null;
        }
    };

    const getSessionRecordingBlob = () =>
        new Promise((resolve) => {
            const sr = sessionRecorderRef.current;

            if (!sr) {
                console.warn("[WebRTC] No session recorder instance");
                return resolve(null);
            }

            if (sr.state === "inactive") {
                if (!sessionChunksRef.current.length) {
                    console.warn(
                        "[WebRTC] Session recorder inactive and no chunks"
                    );
                    return resolve(null);
                }
                const blob = new Blob(sessionChunksRef.current, {
                    type: "video/webm"
                });
                return resolve(blob);
            }

            sr.onstop = () => {
                try {
                    if (!sessionChunksRef.current.length) {
                        console.warn(
                            "[WebRTC] Session recorder stopped, but no chunks"
                        );
                        return resolve(null);
                    }
                    const blob = new Blob(sessionChunksRef.current, {
                        type: "video/webm"
                    });
                    resolve(blob);
                } catch (err) {
                    console.error(
                        "[WebRTC] Error building session recording blob:",
                        err
                    );
                    resolve(null);
                }
            };

            try {
                console.log("[WebRTC] Stopping session recorder...");
                sr.stop();
            } catch (err) {
                console.error(
                    "[WebRTC] Failed to stop session recorder:",
                    err
                );
                resolve(null);
            }
        });

    const stopStreamTracks = (stream) => {
        try {
            stream?.getTracks?.().forEach((t) => {
                try {
                    t.stop();
                } catch {
                    // ignore
                }
            });
        } catch {
            // ignore
        }
    };

    const bindLocalVideoElement = () => {
        const localVideoEl = videoRef.current;
        const preferredStream =
            mixedStreamRef.current || localStream || userStreamRef.current || null;

        if (!localVideoEl || !preferredStream) return;
        if (localVideoEl.srcObject !== preferredStream) {
            localVideoEl.srcObject = preferredStream;
        }

        const maybePlay = localVideoEl.play?.();
        if (maybePlay && typeof maybePlay.catch === "function") {
            maybePlay.catch((err) => {
                console.warn("[WebRTC] Local video play error during rebind:", err);
            });
        }
    };

    useEffect(() => {
        if (!mediaReady) return;
        const raf = window.requestAnimationFrame(() => {
            bindLocalVideoElement();
        });
        return () => window.cancelAnimationFrame(raf);
    }, [
        mediaReady,
        localStream,
        isScreenSharing,
        remoteScreenStreams.length,
        remoteScreenSharingPeers.size
    ]);

    const releaseMediaResources = () => {
        stopStreamTracks(videoRef.current?.srcObject);
        stopStreamTracks(mixedStreamRef.current);
        stopStreamTracks(screenShareStreamRef.current);
        stopStreamTracks(canvasStreamRef.current);
        stopStreamTracks(userStreamRef.current);
        userStreamRef.current = null;
        cameraStreamRef.current = null;
        if (localStream) {
            stopStreamTracks(localStream);
            setLocalStream(null);
        }

        if (screenShareTrackRef.current) {
            try {
                screenShareTrackRef.current.stop();
            } catch {
                // ignore
            }
            screenShareTrackRef.current = null;
        }
        screenShareStreamRef.current = null;
        screenShareStoppingRef.current = false;

        if (originalVideoTrackRef.current) {
            try {
                originalVideoTrackRef.current.stop();
            } catch {
                // ignore
            }
            originalVideoTrackRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        if (canvasDrawIntervalRef.current) {
            clearInterval(canvasDrawIntervalRef.current);
            canvasDrawIntervalRef.current = null;
        }

        if (canvasStreamRef.current) {
            canvasStreamRef.current = null;
        }

        try {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        } catch {
            // ignore
        }
        audioContextRef.current = null;
        mixDestRef.current = null;
        mixedStreamRef.current = null;

        setMediaReady(false);
        setIsCameraOn(false);
        setIsMicOn(false);
        setIsScreenSharing(false);
    };

    const hardCleanup = () => {
        stopSilenceWatch({ resetPromptCount: true });
        stopAIAudio();
        isRecordingRef.current = false;
        clearInterval(timerRef.current);
        if (pendingAiFlushTimeoutRef.current) {
            clearTimeout(pendingAiFlushTimeoutRef.current);
            pendingAiFlushTimeoutRef.current = null;
        }
        pendingAiResponseRef.current = null;
        if (recordingStopTimeoutRef.current) {
            clearTimeout(recordingStopTimeoutRef.current);
            recordingStopTimeoutRef.current = null;
        }
        if (sessionRecordingStopTimeoutRef.current) {
            clearTimeout(sessionRecordingStopTimeoutRef.current);
            sessionRecordingStopTimeoutRef.current = null;
        }

        stopSttCapture();
        try {
            if (sttWsRef.current) {
                sttWsRef.current.close();
            }
        } catch {
            // ignore
        }
        sttWsRef.current = null;
        sttTurnIdRef.current = null;
        sttPendingUserTextRef.current = "";
        sttAudioChunksRef.current = [];
        recordingChunkedEnabledRef.current = false;
        recordingSessionIdRef.current = null;
        recordingChunkSeqRef.current = 0;
        recordingUploadQueueRef.current = Promise.resolve();

        try {
            if (recorderRef.current?.state === "recording") {
                recorderRef.current.stop();
            }
        } catch {
            // ignore
        }

        try {
            const sr = sessionRecorderRef.current;
            if (sr && sr.state !== "inactive") {
                sr.stop();
            }
        } catch {
            // ignore
        }

        try {
            if (signalingRef.current) {
                signalingRef.current.close();
            }
        } catch {
            // ignore
        }
        signalingRef.current = null;

        if (lastAudioUrlRef.current) {
            try {
                URL.revokeObjectURL(lastAudioUrlRef.current);
            } catch {
                // ignore
            }
            lastAudioUrlRef.current = null;
        }

        releaseMediaResources();
        cleanupPeers();
        setRecording(false);
        setAiSpeaking(false);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };
    const displaySeconds =
        callLimitSeconds != null
            ? Math.max(callLimitSeconds - callTime, 0)
            : callTime;

    /* ============================
     *   MEET-STYLE CONTROLS
     * ============================
     */

    const toggleMic = () => {
        const mixed = mixedStreamRef.current;
        if (!mixed) return;

        const audioTracks = mixed.getAudioTracks();
        if (!audioTracks.length) return;

        const nextEnabled = !audioTracks[0].enabled;
        audioTracks.forEach((t) => {
            t.enabled = nextEnabled;
        });
        setIsMicOn(nextEnabled);
    };

    const toggleCamera = () => {
        const mixed = mixedStreamRef.current;
        if (!mixed) return;

        const videoTracks = mixed.getVideoTracks();
        if (!videoTracks.length) return;

        const nextEnabled = !videoTracks[0].enabled;
        videoTracks.forEach((t) => {
            t.enabled = nextEnabled;
        });
        setIsCameraOn(nextEnabled);
    };

    const stopLocalScreenShare = async ({ stoppedByBrowser = false } = {}) => {
        if (screenShareStoppingRef.current) return;
        screenShareStoppingRef.current = true;
        try {
            const screenTrack = screenShareTrackRef.current;
            const displayStream = screenShareStreamRef.current;
            const activeTrackId = screenTrack?.id || null;

            if (activeTrackId) {
                Object.values(peersRef.current).forEach((pc) => {
                    pc.getSenders().forEach((sender) => {
                        if (sender.track?.id === activeTrackId) {
                            try {
                                pc.removeTrack(sender);
                            } catch (err) {
                                console.warn(
                                    "[WebRTC] Failed to remove screen sender:",
                                    err
                                );
                            }
                        }
                    });
                });
                await renegotiateAllPeers("stop-screen-share");
                sendScreenShareSignal("screen-share-stop", {
                    trackId: activeTrackId
                });
            }

            if (screenTrack) {
                screenTrack.onended = null;
                if (!stoppedByBrowser) {
                    try {
                        screenTrack.stop();
                    } catch {
                        // ignore
                    }
                }
            }
            if (displayStream) {
                displayStream.getTracks().forEach((track) => {
                    if (!screenTrack || track.id !== screenTrack.id) {
                        try {
                            track.stop();
                        } catch {
                            // ignore
                        }
                    }
                });
            }
            screenShareTrackRef.current = null;
            screenShareStreamRef.current = null;
            setIsScreenSharing(false);
            window.requestAnimationFrame(() => {
                bindLocalVideoElement();
            });
        } finally {
            screenShareStoppingRef.current = false;
        }
    };

    const toggleScreenShare = async () => {
        const mixed = mixedStreamRef.current;
        if (!mixed) return;

        if (isScreenSharing) {
            await stopLocalScreenShare();
            return;
        }

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });
            const screenTrack = displayStream.getVideoTracks()[0];
            if (!screenTrack) {
                stopStreamTracks(displayStream);
                return;
            }

            screenShareTrackRef.current = screenTrack;
            screenShareStreamRef.current = displayStream;
            setIsScreenSharing(true);
            sendScreenShareSignal("screen-share-start", {
                trackId: screenTrack.id
            });

            Object.values(peersRef.current).forEach((pc) => {
                const alreadySending = pc
                    .getSenders()
                    .some((sender) => sender.track?.id === screenTrack.id);
                if (!alreadySending) {
                    try {
                        pc.addTrack(screenTrack, displayStream);
                    } catch (err) {
                        console.warn(
                            "[WebRTC] Failed to add screen track to peer:",
                            err
                        );
                    }
                }
            });

            await renegotiateAllPeers("start-screen-share");

            screenTrack.onended = () => {
                stopLocalScreenShare({ stoppedByBrowser: true });
            };
        } catch (err) {
            console.error("[WebRTC] Screen share failed:", err);
            await stopLocalScreenShare({ stoppedByBrowser: true });
        }
    };

    /* ============================
     *  READING PASSAGE FLOW
     * ============================
     */

    const loadReadingPassage = async () => {
        if (readingPassageLoading) return null;
        if (!candidateId || !jobId) return null;
        setReadingPassageError("");
        setReadingPassageLoading(true);
        try {
            const res = await fetchData("/api/ai/readingPassage", {
                method: "POST",
                body: { candidateId, jobId, interviewScheduleId, difficultyLevel: scriptMeta.difficultyLevel || "Intermediate" }
            });
            const passage = res?.passage || "";
            if (!passage) { setReadingPassageError("Failed to load a reading passage."); return null; }
            setReadingPassageText(passage);
            setReadingPassageDifficulty(res?.difficultyLevel || scriptMeta.difficultyLevel || "Intermediate");
            return passage;
        } catch (err) {
            setReadingPassageError(err?.error || err?.message || "Failed to load a reading passage.");
            return null;
        } finally {
            setReadingPassageLoading(false);
        }
    };

    const openReadingPassageDialog = async () => {
        if (readingPassageOpen) return;
        setReadingPassageOpen(true);
        if (!readingPassageText) await loadReadingPassage();
    };

    const startReadingRecording = async () => {
        if (readingRecording || readingSubmitting) return;
        setReadingPassageError("");
        const userStream = userStreamRef?.current;
        const audioTracks = userStream?.getAudioTracks?.() || [];
        if (!userStream || audioTracks.length === 0) { setReadingPassageError("Microphone is not available."); return; }
        const audioStream = new MediaStream(audioTracks);
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        try {
            const recorder = new MediaRecorder(audioStream, { mimeType: mime });
            readingChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) readingChunksRef.current.push(e.data); };
            recorder.onerror = () => setReadingPassageError("Recording failed. Please try again.");
            readingRecorderRef.current = recorder;
            recorder.start();
            setReadingRecording(true);
        } catch (err) {
            setReadingPassageError("Recording could not start.");
        }
    };

    const stopReadingRecording = () => new Promise((resolve) => {
        const recorder = readingRecorderRef.current;
        if (!recorder) { resolve(null); return; }
        const finalize = () => {
            const blob = readingChunksRef.current.length > 0 ? new Blob(readingChunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null;
            readingChunksRef.current = [];
            readingRecorderRef.current = null;
            setReadingRecording(false);
            resolve(blob);
        };
        recorder.onstop = finalize;
        try { if (recorder.state !== "inactive") recorder.stop(); else finalize(); } catch { finalize(); }
    });

    const submitReadingPassage = async () => {
        if (readingSubmitting) return;
        if (!readingRecording) { setReadingPassageError("Click Start Reading before submitting."); return; }
        setReadingSubmitting(true);
        try {
            const blob = await stopReadingRecording();
            if (!blob || blob.size < 512) { setReadingPassageError("Recording too short. Please try again."); return; }
            const reader = new FileReader();
            const audioData = await new Promise((res, rej) => { reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(blob); });
            await fetchData("/api/ai/saveReadingPassageAudio", { method: "POST", body: { candidateId, jobId, interviewScheduleId, audioData } });
            setReadingPassageOpen(false);
            setConfirmEndOpen(true);
        } catch (err) {
            setReadingPassageError(err?.error || err?.message || "Failed to save reading audio.");
        } finally {
            setReadingSubmitting(false);
        }
    };

    const cancelReadingPassage = () => {
        try { if (readingRecorderRef.current?.state === "recording") readingRecorderRef.current.stop(); } catch { /* ignore */ }
        readingRecorderRef.current = null;
        readingChunksRef.current = [];
        setReadingRecording(false);
        setReadingSubmitting(false);
        setReadingPassageOpen(false);
        setReadingPassageError("");
    };

    /* ============================
     *   END CALL FLOW
     * ============================
     */

    const endCall = (force = false) => {
        if (force === true) {
            handleConfirmEnd();
            return;
        }
        // If reading passage is enabled and not yet shown, open it first
        if (scriptMeta.readingPassageEnabled && isAIInterviewer && !readingPassageOpen) {
            void openReadingPassageDialog();
            return;
        }
        setConfirmEndOpen(true);
    };

    const handleConfirmEnd = async () => {
        if (endInProgressRef.current) return;
        endInProgressRef.current = true;
        interviewEndedRef.current = true;
        stopSilenceWatch({ resetPromptCount: true });
        setConfirmEndOpen(false);
        setIsInterviewActive(false);

        console.log("[WebRTC] Ending call - stopping media + signaling");
        setUiState({ loadingMsg: "Loading, Please wait..." });

        let authToken = null;
        try {
            authToken = getCookie("token") || localStorage.getItem("token");
        } catch {
            authToken = null;
        }

        const endEventPayload = {
            candidateId,
            jobId,
            interviewScheduleId,
            ...(authToken ? { authToken } : {})
        };
        const endEventUrl = "/api/ai/endInterview";
        const endEventBody = JSON.stringify(endEventPayload);

        if (candidateId || jobId || interviewScheduleId) {
            try {
                let sent = false;
                if (typeof navigator !== "undefined" && navigator.sendBeacon) {
                    const blob = new Blob([endEventBody], { type: "application/json" });
                    sent = navigator.sendBeacon(endEventUrl, blob);
                }

                if (!sent) {
                    fetchData(endEventUrl, {
                        method: "POST",
                        body: endEventPayload,
                        keepalive: true
                    }).catch((err) => {
                        console.error("[WebRTC] endInterview event failed:", err);
                    });
                }
            } catch (err) {
                console.error("[WebRTC] endInterview event error:", err);
            }
        }

        let recordingBlob = null;
        if (sessionRecordingUploadedRef.current) {
            console.log(
                "[WebRTC] Session recording already uploaded; skipping blob retrieval"
            );
        } else if (recordingChunkedEnabledRef.current) {
            await finalizeServerRecording();
        } else {
            try {
                recordingBlob = await getSessionRecordingBlob();
            } catch (err) {
                console.error(
                    "[WebRTC] Failed to get session recording blob:",
                    err
                );
            }
        }




        // Stop all media as soon as we have the recording blob.
        hardCleanup();

        try {
            if (!recordingChunkedEnabledRef.current && !sessionRecordingUploadedRef.current && recordingBlob && candidateId && jobId) {
                try {
                    console.log(
                        "[WebRTC] Uploading full recording to /api/ai/saveRecording..."
                    );
                    const recordingBase64 = await blobToBase64(recordingBlob);
                    await fetchData("/api/ai/saveRecording", {
                        method: "POST",
                        body: {
                            candidateId,
                            jobId,
                            recordingData: recordingBase64,
                            interviewScheduleId
                        }
                    });
                    sessionRecordingUploadedRef.current = true;
                } catch (err) {
                    console.error("[WebRTC] Failed to upload recording (multipart):", err);
                }
            } else if (sessionRecordingUploadedRef.current) {
                console.log("[WebRTC] Recording upload already completed; skipping upload");
            }

            // NEW: persist anti-cheat snapshot for this interview so PDF can show proper proctoring data
            if (isAIInterviewer && candidateId && jobId && isAntiCheatEnabled) {
                try {
                    const snapshot = {
                        tabSwitchCount: antiCheatState.tabSwitchCount || 0,
                        violationCount: antiCheatState.violationCount || 0,
                        lastViolationReason:
                            antiCheatState.lastViolationReason || null,
                        reasonCounts: antiCheatState.reasonCounts || {}
                    };

                    console.log(
                        "[WebRTC] Sending anti-cheat snapshot to /api/ai/saveAntiCheat...",
                        snapshot
                    );

                    await fetchData("/api/ai/saveAntiCheat", {
                        method: "POST",
                        body: {
                            candidateId,
                            jobId,
                            antiCheat: snapshot,
                            interviewScheduleId
                        }
                    });
                } catch (err) {
                    console.error(
                        "[WebRTC] Failed to send anti-cheat snapshot:",
                        err
                    );
                }
            }

            if (scriptMeta.roundType === "Coding" && interviewScheduleId) {
                try {
                    const best = await fetchData(
                        `/api/codejudge/interviews/${interviewScheduleId}/best-submission`
                    );
                    if (best?._id) {
                        await fetchData(
                            `/api/codejudge/submissions/${best._id}/finalize`,
                            {
                                method: "PATCH",
                                body: { isFinalSubmission: true }
                            }
                        );
                    }
                } catch (err) {
                    console.error(
                        "[WebRTC] Failed to auto-finalize best coding submission:",
                        err
                    );
                }
            }

            setUiState({ loadingMsg: null });
            navigate("/");
        } finally {
            hardCleanup();
        }
    };

    const handleCancelEnd = () => {
        setConfirmEndOpen(false);
    };

    // const handleCloseEvaluation = () => {
    //     setEvaluationOpen(false);
    //     navigate("/");
    // };

    const currentUserDisplayName = (() => {
        const u = authState?.user;
        return (`${u?.firstName || ""} ${u?.lastName || ""}`).trim() || u?.email || null;
    })();

    const humanModeTitle = isHybridInterviewer
        ? "Live Interview + AI Assist"
        : "Live Interview";

    const title = scriptMeta.jobTitle
        ? `Virtual Interview: ${isAIInterviewer ? "Technical Screening" : humanModeTitle
        } for ${scriptMeta.jobTitle}`
        : isAIInterviewer
            ? "WebRTCAI • Technical Screening"
            : "Virtual Interview Room";

    const antiCheatWarningText = antiCheatState.lastViolationReason
        ? getAntiCheatMessageForReason(antiCheatState.lastViolationReason)
        : "camera must stay on and this tab must remain in focus throughout the interview.";

    const primary = theme.palette.primary.main;
    const primaryDark = theme.palette.primary.dark;
    const textPrimary = theme.palette.text.primary;
    const textMuted = theme.palette.text.secondary;
    const surface = theme.palette.background.paper;
    const surfaceMuted = theme.palette.background.default;
    const border = theme.palette.divider;
    const info = theme.palette.info.main;
    const success = theme.palette.success.main;
    const warning = theme.palette.warning.main;
    const error = theme.palette.error.main;
    const onPrimary = theme.palette.getContrastText(primary);
    const onSuccess = theme.palette.getContrastText(success);

    const pageBg = surfaceMuted;
    const cardBg = surface;
    const frameBg = surface;
    const frameBorder = border;
    const textColorPrimary = textPrimary;
    const subTextColor = textMuted;

    const shadowSoft = theme.shadows[2] || "none";
    const shadowStrong = theme.shadows[4] || shadowSoft;

    // NEW: control strip colors
    const controlsGroupBg = alpha(primary, isDarkMode ? 0.12 : 0.06);
    const controlsGroupBorder = alpha(primary, isDarkMode ? 0.3 : 0.2);
    const controlsLabelColor = textPrimary;

    const recordingPillBg = success;
    const recordingPillText = onSuccess;

    const shellVars = {
        "--webrtc-font": "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
        "--webrtc-surface": cardBg,
        "--webrtc-surface-muted": surfaceMuted,
        "--webrtc-panel": frameBg,
        "--webrtc-panel-border": frameBorder,
        "--webrtc-border": border,
        "--webrtc-accent": primary,
        "--webrtc-accent-strong": primaryDark,
        "--webrtc-accent-soft": alpha(primary, isDarkMode ? 0.2 : 0.12),
        "--webrtc-accent-soft-strong": alpha(primary, isDarkMode ? 0.35 : 0.2),
        "--webrtc-success": success,
        "--webrtc-success-soft": alpha(success, isDarkMode ? 0.2 : 0.12),
        "--webrtc-warning": warning,
        "--webrtc-warning-soft": alpha(warning, isDarkMode ? 0.2 : 0.12),
        "--webrtc-error": error,
        "--webrtc-error-soft": alpha(error, isDarkMode ? 0.2 : 0.12),
        "--webrtc-info": info,
        "--webrtc-info-soft": alpha(info, isDarkMode ? 0.2 : 0.12),
        "--webrtc-on-accent": onPrimary,
        "--webrtc-overlay": alpha(theme.palette.common.black, 0.6),
        "--webrtc-overlay-soft": alpha(theme.palette.common.black, 0.45),
        "--webrtc-overlay-light": alpha(theme.palette.common.black, 0.18),
        "--webrtc-disabled-bg": alpha(textMuted, isDarkMode ? 0.3 : 0.2),
        "--webrtc-disabled-text": textMuted,
        "--webrtc-shadow-soft": shadowSoft,
        "--webrtc-shadow-strong": shadowStrong
    };

    const panelHeight = isSm ? "auto" : "360px";
    const panelPadding = isXs ? "12px" : "16px";
    const avatarSize = isSm ? 220 : isMd ? 260 : 300;
    const shellWidth = isXs ? "95%" : "92%";

    const sizeClass = isXs
        ? "webrtc-size-xs"
        : isSm
            ? "webrtc-size-sm"
            : isMd
                ? "webrtc-size-md"
                : "webrtc-size-lg";
    const themeClass = isDarkMode ? "webrtc-dark" : "webrtc-light";
    const interviewerClass = isAIInterviewer ? "webrtc-ai" : "webrtc-human";

    const useLightTopbar = isAIInterviewer;
    const topbarBg = useLightTopbar ? surface : primary;
    const topbarText = useLightTopbar ? primary : onPrimary;
    const topbarSubtext = useLightTopbar ? textMuted : alpha(topbarText, 0.8);
    const topbarChipBg = useLightTopbar ? surface : alpha(topbarText, 0.16);
    const topbarChipBorder = useLightTopbar ? alpha(primary, 0.45) : alpha(topbarText, 0.25);
    const topbarTimerBg = useLightTopbar ? surface : alpha(topbarText, 0.22);
    const topbarBorder = useLightTopbar ? alpha(primary, 0.35) : alpha(topbarText, 0.25);

    const rootVars = {
        ...shellVars,
        "--webrtc-page-bg": pageBg,
        "--webrtc-text-primary": textColorPrimary,
        "--webrtc-text-muted": subTextColor,
        "--webrtc-topbar-bg": topbarBg,
        "--webrtc-topbar-text": topbarText,
        "--webrtc-topbar-subtext": topbarSubtext,
        "--webrtc-topbar-chip-bg": topbarChipBg,
        "--webrtc-topbar-chip-text": topbarText,
        "--webrtc-topbar-chip-border": topbarChipBorder,
        "--webrtc-topbar-timer-bg": topbarTimerBg,
        "--webrtc-topbar-border": topbarBorder,
        "--webrtc-shadow-soft": shadowSoft,
        "--webrtc-shadow-strong": shadowStrong,
        "--webrtc-controls-bg": controlsGroupBg,
        "--webrtc-controls-border": controlsGroupBorder,
        "--webrtc-controls-label": controlsLabelColor,
        "--webrtc-recording-pill-bg": recordingPillBg,
        "--webrtc-recording-pill-text": recordingPillText,
        "--webrtc-panel-padding": panelPadding,
        "--webrtc-panel-padding-tight": isXs ? "10px" : "12px",
        "--webrtc-panel-height": panelHeight,
        "--webrtc-panel-min-height": isSm ? "auto" : "360px",
        "--webrtc-avatar-size": `${avatarSize}px`,
        "--webrtc-shell-width": shellWidth,
        "--webrtc-shell-max-width": isMd ? "1120px" : "1250px",
        "--webrtc-question-bg": surface,
        "--webrtc-question-border": border,
        "--webrtc-question-shadow": shadowSoft,
        "--webrtc-question-progress-bg": alpha(primary, isDarkMode ? 0.2 : 0.12),
        "--webrtc-question-progress-fill": primary,
        "--webrtc-question-muted": textMuted,
        "--webrtc-avatar-status-bg": alpha(surface, isDarkMode ? 0.8 : 0.9),
        "--webrtc-proctoring-bg": alpha(surface, isDarkMode ? 0.88 : 0.95),
        "--webrtc-proctoring-border": border,
        "--webrtc-frame-border": `1px solid ${border}`,
        "--webrtc-remote-border": `1px solid ${border}`,
        "--webrtc-transcript-bg": surfaceMuted,
        "--webrtc-transcript-padding": isXs ? "10px 12px" : "12px 14px",
        "--webrtc-transcript-max-height": isSm ? "none" : "360px",
        "--webrtc-transcript-border": border,
        "--webrtc-transcript-empty": textMuted,
        "--webrtc-transcript-ai": textPrimary,
        "--webrtc-human-grid-padding": isXs ? "10px" : "12px",
        "--webrtc-waiting-color": textMuted,
        "--webrtc-human-note-bg": surfaceMuted,
        "--webrtc-human-note-border": border,
        "--webrtc-instructions-bg": alpha(surface, isDarkMode ? 0.9 : 0.96),
        "--webrtc-instructions-padding": isXs ? "12px 14px" : "14px 16px",
        "--webrtc-bottom-bar-bg": alpha(surface, isDarkMode ? 0.92 : 0.98),
        "--webrtc-bottom-transcript-bg": surface,
        "--webrtc-avatar-bg": surface
    };

    const aiGridTemplateAreas = isSm
        ? `"video" "question" "avatar"`
        : isMd
            ? `"video question" "avatar question"`
            : `"video question avatar"`;
    const aiGridTemplateColumns = isSm
        ? "1fr"
        : isMd
            ? "1.05fr 1.35fr"
            : "1.1fr 1.45fr 0.9fr";
    const lastAiPrompt = useMemo(() => {
        for (let i = conversation.length - 1; i >= 0; i -= 1) {
            const entry = conversation[i];
            if (
                entry?.ai &&
                !entry?.meta?.isGreeting &&
                !entry?.meta?.isSilencePrompt
            ) {
                return entry.ai;
            }
        }
        return "";
    }, [conversation]);
    const questionNumber = useMemo(() => {
        const aiQuestions = conversation.filter(
            (entry) =>
                entry?.ai &&
                !entry?.meta?.isGreeting &&
                !entry?.meta?.isSilencePrompt
        );
        return aiQuestions.length > 0 ? aiQuestions.length : 1;
    }, [conversation]);
    const questionText =
        lastAiPrompt || "When you're ready, click Start Answering.";
    const answerStatus = isRecording
        ? "You're answering..."
        : "Ready when you are";
    const aiStatus = isRecording
        ? "Listening..."
        : aiSpeaking
            ? "Speaking..."
            : "Ready";
    const topBarTitle = scriptMeta.jobTitle
        ? `${isAIInterviewer ? "Technical Screening" : humanModeTitle} - ${scriptMeta.jobTitle}`
        : title;
    const toggleTranscript = () => {
        setShowTranscript((prev) => !prev);
        if (transcriptRef.current) {
            transcriptRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    };

    if (linkError) {
        return (
            <div className="webrtc-link-error">
                <div className="webrtc-link-error-card">
                    <h2>Interview Link Unavailable</h2>
                    <p>{linkError}</p>
                </div>
            </div>
        );
    }

    const displayTime = formatTime(displaySeconds);
    const humanParticipantCount = Math.max(
        roomSnapshot?.participantCount || 0,
        remoteStreams.length + 1,
        1
    );

    const standardView = (
        <div
            className={`webrtc-root ${sizeClass} ${themeClass} ${interviewerClass}`}
            style={rootVars}
        >
            {isAIInterviewer ? (
                <WebRTCAIView
                    topBarTitle={topBarTitle}
                    candidateName={scriptMeta.candidateName}
                    questionNumber={questionNumber}
                    displayTime={displayTime}
                    videoRef={videoRef}
                    remoteStreams={remoteStreams}
                    isXs={isXs}
                    isSm={isSm}
                    aiGridTemplateColumns={aiGridTemplateColumns}
                    aiGridTemplateAreas={aiGridTemplateAreas}
                    showTranscript={showTranscript}
                    onToggleTranscript={toggleTranscript}
                    transcriptRef={transcriptRef}
                    conversation={conversation}
                    questionText={questionText}
                    answerStatus={answerStatus}
                    isRecording={isRecording}
                    clickedAction={clickedAction}
                    isInterviewPaused={isInterviewPaused}
                    isSlowMode={isSlowMode}
                    onRepeatQuestion={handleRepeatQuestion}
                    onPauseQuestion={handlePauseQuestion}
                    onSlowDownQuestion={handleSlowDownQuestion}
                    onStartRecording={startRecording}
                    onStopRecording={stopRecording}
                    mediaReady={mediaReady}
                    startRecordingBusy={startRecordingBusy}
                    startRecordingError={startRecordingError}
                    endCall={endCall}
                    aiSpeaking={aiSpeaking}
                    aiStatus={aiStatus}
                    audioRef={audioRef}
                    avatarSize={avatarSize}
                    isAntiCheatActive={isAntiCheatActive}
                    antiCheatState={antiCheatState}
                    antiCheatWarningText={antiCheatWarningText}
                    onDismissAntiCheat={() =>
                        setAntiCheatState((prev) => ({
                            ...prev,
                            hasActiveViolationBanner: false
                        }))
                    }
                />
            ) : (
                <WebRTCHumanView
                    title={title}
                    interviewerType={scriptMeta.interviewerType}
                    candidateName={scriptMeta.candidateName}
                    userRole={userRole}
                    currentUserDisplayName={currentUserDisplayName}
                    peerNamesMap={peerNamesMap}
                    videoRef={videoRef}
                    cameraStreamRef={cameraStreamRef}
                    screenStreamRef={screenShareStreamRef}
                    remoteStreams={remoteStreams}
                    remoteScreenStreams={remoteScreenStreams}
                    remoteScreenSharingPeers={remoteScreenSharingPeers}
                    isXs={isXs}
                    isSm={isSm}
                    displayTime={displayTime}
                    roomParticipantCount={humanParticipantCount}
                    isInterviewActive={isInterviewActive}
                    isMicOn={isMicOn}
                    toggleMic={toggleMic}
                    isCameraOn={isCameraOn}
                    toggleCamera={toggleCamera}
                    isScreenSharing={isScreenSharing}
                    toggleScreenShare={toggleScreenShare}
                    endCall={endCall}
                    conversation={conversation}
                    isChatOpen={humanChatOpen}
                    onToggleChat={() => setHumanChatOpen((prev) => !prev)}
                    onCloseChat={() => setHumanChatOpen(false)}
                    chatDrawerAnchor="right"
                    chatMessages={humanChatMessages}
                    chatDraft={humanChatDraft}
                    onChatDraftChange={setHumanChatDraft}
                    onSendChatMessage={handleSendHumanChatMessage}
                    onSendChatFile={handleSendHumanChatFile}
                    chatError={humanChatError}
                />
            )}
        </div>
    );

    // Main Render
    return (
        <>
            {/* 1. Main Content: Coding View OR Standard View */}
            {scriptMeta.roundType === 'Coding' ? (
                <Suspense fallback={<div className="webrtc-loading">Loading coding interview...</div>}>
                    <CodingWebRTC
                        videoRef={videoRef}
                        remoteStreams={remoteStreams}
                        scriptMeta={scriptMeta}
                        isMicOn={isMicOn}
                        toggleMic={toggleMic}
                        isCameraOn={isCameraOn}
                        toggleCamera={toggleCamera}
                        endCall={endCall}
                        localStream={localStream}
                    />
                </Suspense>
            ) : (
                standardView
            )}

            {/* 2. Global Dialogs (Always active) */}
            <WebRTCEndInterviewDialog
                open={confirmEndOpen}
                onCancel={handleCancelEnd}
                onConfirm={handleConfirmEnd}
                isAIInterviewer={isAIInterviewer}
                isXs={isXs}
            />

            <WebRTCReadingPassageDialog
                open={readingPassageOpen}
                passage={readingPassageText}
                difficultyLevel={readingPassageDifficulty}
                loading={readingPassageLoading}
                error={readingPassageError}
                isRecording={readingRecording}
                isSubmitting={readingSubmitting}
                onStartRecording={startReadingRecording}
                onSubmit={submitReadingPassage}
                onRetry={loadReadingPassage}
                onCancel={cancelReadingPassage}
                isXs={isXs}
            />

            <WebRTCFaceMismatchDialog
                open={faceMismatchOpen}
                matchScore={faceMatchState?.score}
                thresholdPercent={identityMatchThresholdPercent}
                onClose={() => setFaceMismatchOpen(false)}
            />

            <WebRTCInterviewPausedDialog
                open={isInterviewPaused}
                onResume={resumeInterview}
                isXs={isXs}
            />

            <WebRTCSystemCheckDialog
                open={!systemCheckPassed}
                results={systemCheckResults}
                consentChecked={systemCheckConsent}
                onConsentChange={setSystemCheckConsent}
                errorMessage={systemCheckError}
                running={systemCheckRunning}
                attempted={systemCheckAttempted}
                onRunCheck={runSystemCheck}
                onContinue={() => setSystemCheckPassed(true)}
                previewStream={systemCheckStream}
                micLevel={systemCheckMicLevel}
                topbarBg={topbarBg}
                isXs={isXs}
            />

            <WebRTCConsentDialog
                open={!consentAccepted && systemCheckPassed}
                consentChecked={consentChecked}
                onConsentChange={setConsentChecked}
                consentSubmitting={consentSubmitting}
                onStartInterview={handleStartInterview}
                interviewerType={scriptMeta.interviewerType}
                userRole={userRole}
                isXs={isXs}
            />
        </>
    );
}
