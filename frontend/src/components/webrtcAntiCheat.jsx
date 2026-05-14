/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from "react";

/**
 * Central anti-cheat configuration defaults.
 */
export const defaultAntiCheatConfig = {
    isEnabled: true,
    cameraRequired: true,
    tabSwitchLimit: 3,
    autoEndOnViolation: false,

    // Video & audio based checks
    singlePersonInFrameRequired: true,
    multiVoiceDetectionEnabled: true,
    screenshotDetectionEnabled: true,
    faceCheckIntervalMs: 3000,
    voiceDetectionIntervalMs: 6000,
    screenshotAttemptCooldownMs: 2000
};

export const createInitialAntiCheatState = () => ({
    tabSwitchCount: 0,
    lastViolationReason: null,
    hasActiveViolationBanner: false,
    violationCount: 0,
    reasonCounts: {}
});

export const ANTI_CHEAT_REASON_LABELS = {
    TAB_HIDDEN: "we detected that you moved away from the interview tab.",
    WINDOW_BLUR: "your browser window lost focus (possible tab/app switch).",
    CAMERA_TOGGLE_BLOCKED: "camera switch-off is not allowed in this interview.",
    CAMERA_TRACK_ENDED:
        "your camera stream is not active. Camera must remain on throughout the interview.",
    MULTIPLE_FACES_DETECTED:
        "we detected that your camera frame does not show exactly one person. Only you should be visible during this interview.",
    SCREENSHOT_ATTEMPTED:
        "we detected a screenshot attempt. Screenshots are not allowed during this interview.",
    MULTIPLE_VOICES_DETECTED:
        "we detected strong indications of multiple voices near your microphone. You must complete this interview without external assistance."
};

export const getAntiCheatMessageForReason = (reason) =>
    ANTI_CHEAT_REASON_LABELS[reason] ||
    "we detected unexpected activity during the interview.";

/**
 * Hook: Tab visibility + window focus monitoring.
 */
export function useTabAndWindowAntiCheat(isAntiCheatEnabled, registerViolation) {
    useEffect(() => {
        if (!isAntiCheatEnabled) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                console.log("[AntiCheat] document.hidden -> TAB_HIDDEN violation");
                registerViolation("TAB_HIDDEN");
            }
        };

        const handleWindowBlur = () => {
            if (!document.hidden) {
                console.log(
                    "[AntiCheat] window blur while tab visible -> WINDOW_BLUR violation"
                );
                registerViolation("WINDOW_BLUR");
            }
        };

        window.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, [isAntiCheatEnabled, registerViolation]);
}

/**
 * Hook: Camera track lifecycle monitoring.
 * - Detects camera being turned off / revoked outside the app.
 */
export function useCameraTrackAntiCheat({
    isAntiCheatEnabled,
    cameraTrackRef,
    videoRef,
    registerViolation
}) {
    useEffect(() => {
        if (!isAntiCheatEnabled) return;

        let intervalId = null;
        let attachedTrack = null;
        let lastState = "unknown"; // "ok" | "violation" | "unknown"

        const markViolation = () => {
            if (lastState === "violation") return;
            lastState = "violation";
            console.log("[AntiCheat] Camera track not live / disabled -> CAMERA_TRACK_ENDED");
            registerViolation("CAMERA_TRACK_ENDED");
        };

        const markOk = () => {
            if (lastState !== "ok") {
                lastState = "ok";
            }
        };

        const handleEnded = () => {
            console.log("[AntiCheat] Camera track ended event fired.");
            markViolation();
        };

        const attachEndedListenerIfPossible = () => {
            const t = cameraTrackRef?.current;
            if (!t || t === attachedTrack) return;

            try {
                if (attachedTrack) {
                    attachedTrack.removeEventListener("ended", handleEnded);
                }
                t.addEventListener("ended", handleEnded);
                attachedTrack = t;
            } catch (err) {
                console.warn("[AntiCheat] Failed to attach camera track listener:", err);
            }
        };

        intervalId = window.setInterval(() => {
            const t = cameraTrackRef?.current;
            const videoEl = videoRef?.current;

            // No track yet -> one violation then wait
            if (!t) {
                markViolation();
                return;
            }

            attachEndedListenerIfPossible();

            const notLive = t.readyState !== "live";
            const disabled = t.enabled === false;
            const muted = t.muted === true;

            const noVideoDimensions =
                videoEl &&
                (videoEl.videoWidth === 0 ||
                    videoEl.videoHeight === 0 ||
                    videoEl.readyState < 2);

            if (notLive || disabled || muted || noVideoDimensions) {
                markViolation();
            } else {
                markOk();
            }
        }, 2500);

        return () => {
            if (intervalId) window.clearInterval(intervalId);
            if (attachedTrack) {
                try {
                    attachedTrack.removeEventListener("ended", handleEnded);
                } catch {
                    // ignore
                }
            }
        };
    }, [isAntiCheatEnabled, registerViolation]);
}

/**
 * Hook: Screenshot attempt detection (best-effort).
 * - Uses key combo heuristics for PrintScreen and common OS shortcuts.
 */
export function useScreenshotAntiCheat({
    isEnabled,
    registerViolation,
    cooldownMs
}) {
    useEffect(() => {
        if (!isEnabled) return;

        const isMac =
            typeof navigator !== "undefined" &&
            /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");

        const cooldown =
            typeof cooldownMs === "number" && cooldownMs >= 0 ? cooldownMs : 2000;

        let lastTriggeredAt = 0;
        let metaKeyDownAt = 0;
        let metaKeyPressed = false;

        const nowMs = () => (performance?.now ? performance.now() : Date.now());
        const META_STALE_MS = 1500;

        const isMetaKeyEvent = (event) => {
            const key = event.key || "";
            const code = event.code || "";
            return (
                key === "Meta" ||
                key === "OS" ||
                code === "MetaLeft" ||
                code === "MetaRight" ||
                code === "OSLeft" ||
                code === "OSRight"
            );
        };

        const updateMetaState = (event, now) => {
            if (!isMetaKeyEvent(event)) return;
            if (event.type === "keydown") {
                metaKeyPressed = true;
                metaKeyDownAt = now;
            } else if (event.type === "keyup") {
                metaKeyPressed = false;
            }
        };

        const isPrintScreenKey = (event) => {
            const key = event.key || "";
            const code = event.code || "";
            const keyLower = key.toLowerCase();
            const keyCode = event.keyCode || event.which || null;

            return (
                key === "PrintScreen" ||
                key === "Print" ||
                key === "Snapshot" ||
                keyLower === "prtsc" ||
                keyLower === "prtscn" ||
                keyLower === "prtscr" ||
                code === "PrintScreen" ||
                code === "Snapshot" ||
                keyCode === 44
            );
        };

        const getShortcutType = (event, now) => {
            const keyLower = (event.key || "").toLowerCase();
            const metaActive =
                event.metaKey ||
                (typeof event.getModifierState === "function" &&
                    event.getModifierState("Meta")) ||
                (metaKeyPressed && now - metaKeyDownAt <= META_STALE_MS);

            if (isPrintScreenKey(event)) {
                return metaActive ? "win-printscreen" : "printscreen";
            }

            // macOS: Shift + Cmd + 3/4/5
            if (isMac && metaActive && event.shiftKey) {
                if (keyLower === "3" || keyLower === "4" || keyLower === "5") {
                    return "mac-screenshot";
                }
            }

            // Windows Snipping Tool: Win + Shift + S
            if (!isMac && metaActive && event.shiftKey && keyLower === "s") {
                return "snipping-tool";
            }

            return null;
        };

        const handleKeyEvent = (event) => {
            const now = nowMs();
            updateMetaState(event, now);
            if (event.repeat) return;

            const shortcutType = getShortcutType(event, now);
            if (!shortcutType) return;
            if (now - lastTriggeredAt < cooldown) return;

            lastTriggeredAt = now;
            console.warn("[AntiCheat] Screenshot attempt detected:", {
                shortcutType,
                key: event.key,
                code: event.code
            });
            registerViolation("SCREENSHOT_ATTEMPTED");
        };

        // window listeners are enough; no need to double-register on document too
        window.addEventListener("keydown", handleKeyEvent, true);
        window.addEventListener("keyup", handleKeyEvent, true);

        return () => {
            window.removeEventListener("keydown", handleKeyEvent, true);
            window.removeEventListener("keyup", handleKeyEvent, true);
        };
    }, [isEnabled, cooldownMs, registerViolation]);
}

/**
 * Hook: Block clipboard interactions (copy / cut / paste).
 * Lightweight guard for coding interviews.
 */
export function useClipboardBlocker(isEnabled) {
    useEffect(() => {
        if (!isEnabled) return;

        const blockEvent = (event) => {
            event.preventDefault();
            event.stopPropagation();
        };

        const blockShortcut = (event) => {
            const key = String(event.key || "").toLowerCase();
            const hasModifier = event.ctrlKey || event.metaKey;
            const isCombo = hasModifier && (key === "c" || key === "v" || key === "x");
            const isShiftInsert = event.shiftKey && key === "insert";
            if (isCombo || isShiftInsert) {
                blockEvent(event);
            }
        };

        document.addEventListener("copy", blockEvent, true);
        document.addEventListener("cut", blockEvent, true);
        document.addEventListener("paste", blockEvent, true);
        document.addEventListener("keydown", blockShortcut, true);

        return () => {
            document.removeEventListener("copy", blockEvent, true);
            document.removeEventListener("cut", blockEvent, true);
            document.removeEventListener("paste", blockEvent, true);
            document.removeEventListener("keydown", blockShortcut, true);
        };
    }, [isEnabled]);
}

/* ============================================================================
 * FACE DETECTION BACKEND
 *  - Prefer native FaceDetector when available (secure context only).
 *  - Fallback to MediaPipe runtime ONLY if VITE_MEDIAPIPE_FACE_DETECTOR_PATH is set.
 *  - Otherwise fallback to TFJS (WebGL -> CPU).
 * ========================================================================== */

// IMPORTANT: No hardcoded CDN link. Use ENV only.
const MEDIAPIPE_FACE_DETECTOR_SOLUTION_PATH =
    import.meta.env?.VITE_MEDIAPIPE_FACE_DETECTOR_PATH || "";
console.log("[AntiCheat] MEDIAPIPE_FACE_DETECTOR_SOLUTION_PATH set:", !!MEDIAPIPE_FACE_DETECTOR_SOLUTION_PATH);

let tfFaceDetectorSingleton = null;
let tfFaceDetectorInitPromise = null;
let tfFaceDetectorUsers = 0;
let loggedNoNativeFaceDetector = false;
let tfFaceDetectorRuntime = null;

const disposeTfFaceDetector = () => {
    try {
        if (
            tfFaceDetectorSingleton &&
            typeof tfFaceDetectorSingleton.dispose === "function"
        ) {
            tfFaceDetectorSingleton.dispose();
        }
    } catch {
        // ignore
    }
    tfFaceDetectorSingleton = null;
    tfFaceDetectorInitPromise = null;
    tfFaceDetectorRuntime = null;
};

async function loadTfFaceDetector(options = {}) {
    const forceTfjs = !!options.forceTfjs;

    if (tfFaceDetectorSingleton && !forceTfjs) return tfFaceDetectorSingleton;
    if (tfFaceDetectorInitPromise && !forceTfjs) return tfFaceDetectorInitPromise;

    if (forceTfjs) {
        disposeTfFaceDetector();
    }

    tfFaceDetectorInitPromise = (async () => {
        try {
            const faceDetection = await import("@tensorflow-models/face-detection");

            // MediaPipe runtime path only when env is provided and not forcing TFJS
            const canUseMediapipeRuntime =
                !forceTfjs && typeof MEDIAPIPE_FACE_DETECTOR_SOLUTION_PATH === "string" &&
                MEDIAPIPE_FACE_DETECTOR_SOLUTION_PATH.trim().length > 0;

            if (canUseMediapipeRuntime) {
                try {
                    const detector = await faceDetection.createDetector(
                        faceDetection.SupportedModels.MediaPipeFaceDetector,
                        {
                            runtime: "mediapipe",
                            maxFaces: 5,
                            modelType: "short",
                            solutionPath: MEDIAPIPE_FACE_DETECTOR_SOLUTION_PATH.trim()
                        }
                    );

                    tfFaceDetectorSingleton = detector;
                    tfFaceDetectorRuntime = "mediapipe";
                    console.log("[AntiCheat] MediaPipe face detector initialised (fallback).", {
                        solutionPath: MEDIAPIPE_FACE_DETECTOR_SOLUTION_PATH.trim()
                    });
                    return detector;
                } catch (err) {
                    console.warn(
                        "[AntiCheat] MediaPipe face detector init failed; falling back to TFJS.",
                        err
                    );
                }
            } else {
                console.warn(
                    "[AntiCheat] VITE_MEDIAPIPE_FACE_DETECTOR_PATH not set; skipping MediaPipe runtime and using TFJS fallback."
                );
            }

            // TFJS backend fallback: WebGL -> CPU
            const tfCore = await import("@tensorflow/tfjs-core");
            await import("@tensorflow/tfjs-backend-webgl");
            await import("@tensorflow/tfjs-backend-cpu");

            try {
                await tfCore.setBackend("webgl");
            } catch (e) {
                console.warn("[AntiCheat] WebGL backend not available, falling back to CPU.", e);
                await tfCore.setBackend("cpu");
            }
            await tfCore.ready();

            const detector = await faceDetection.createDetector(
                faceDetection.SupportedModels.MediaPipeFaceDetector,
                {
                    runtime: "tfjs",
                    maxFaces: 5,
                    modelType: "short"
                }
            );

            tfFaceDetectorSingleton = detector;
            tfFaceDetectorRuntime = "tfjs";
            console.log("[AntiCheat] TFJS face detector initialised (fallback).", {
                backend: tfCore.getBackend?.()
            });
            return detector;
        } catch (err) {
            console.error("[AntiCheat] Failed to initialise face detector fallback.", err);
            tfFaceDetectorSingleton = null;
            tfFaceDetectorRuntime = null;
            throw err;
        }
    })();

    return tfFaceDetectorInitPromise;
}

/**
 * Hook: Single-person-in-frame detection.
 * BUSINESS RULE:
 *  - Exactly ONE face must be visible.
 *  - 0 faces or >1 faces -> violation (repeated per interval if persists).
 */
export function useSinglePersonDetection({
    isEnabled,
    videoRef,
    detectionIntervalMs,
    registerViolation
}) {
    useEffect(() => {
        if (!isEnabled) return;

        let cancelled = false;
        let nativeDetector = null;
        let usingNativeDetector = false;
        let usingFallbackDetector = false;
        let intervalId = null;
        let fallbackReady = false;
        let fallbackInitPromise = null;
        let nativeErrorCount = 0;
        let fallbackErrorCount = 0;
        let forceTfjsAttempted = false;

        const MAX_NATIVE_ERRORS = 2;
        const MAX_FALLBACK_ERRORS = 3;

        let lastState = "unknown"; // "ok" | "violation" | "unknown"
        let lastViolationType = null; // "no-face" | "multi-face" | null
        let lastVideoStatus = null; // "missing" | "not-ready" | "ready" | null
        let lastDetectorStatus = null; // "native" | "mediapipe" | "tfjs" | "none" | null
        let lastFaceCount = null;
        let lastViolationAt = null;

        const logVideoStatus = (status, details) => {
            if (lastVideoStatus === status) return;
            lastVideoStatus = status;

            if (status === "missing") {
                console.log("[AntiCheat] Face detection skipped: video element missing.");
                return;
            }
            if (status === "not-ready") {
                console.log("[AntiCheat] Face detection waiting for video frame.", details || {});
                return;
            }
            console.log("[AntiCheat] Face detection video ready.");
        };

        const logDetectorStatus = (status) => {
            if (lastDetectorStatus === status) return;
            lastDetectorStatus = status;

            if (status === "none") {
                console.warn("[AntiCheat] Face detection skipped: no detector backend available.");
                return;
            }
            console.log("[AntiCheat] Face detection backend:", status);
        };

        const ensureFallbackDetector = async (reason, options = {}) => {
            const forceTfjs = !!options.forceTfjs;
            if (cancelled) return false;

            if (tfFaceDetectorSingleton && usingFallbackDetector && !forceTfjs) return true;
            if (fallbackInitPromise && !forceTfjs) return fallbackInitPromise;

            fallbackInitPromise = (async () => {
                try {
                    await loadTfFaceDetector(options);
                    if (cancelled || !tfFaceDetectorSingleton) return false;

                    usingNativeDetector = false;
                    usingFallbackDetector = true;

                    if (!fallbackReady) {
                        tfFaceDetectorUsers += 1;
                        fallbackReady = true;
                    }

                    console.log("[AntiCheat] Using fallback face detector:", reason || "fallback", {
                        runtime: tfFaceDetectorRuntime
                    });
                    return true;
                } catch (err) {
                    console.warn("[AntiCheat] Failed to initialise fallback face detector:", err);
                    return false;
                } finally {
                    fallbackInitPromise = null;
                }
            })();

            return fallbackInitPromise;
        };

        const runDetectionLoop = async () => {
            const intervalMs = detectionIntervalMs || 3000;
            if (cancelled) return;

            console.log("[AntiCheat] Face detection loop started.", {
                intervalMs,
                isSecureContext: window.isSecureContext,
                hasNativeFaceDetector: !!window.FaceDetector,
                mediapipePath: MEDIAPIPE_FACE_DETECTOR_SOLUTION_PATH || "(not set)"
            });

            intervalId = window.setInterval(async () => {
                if (cancelled) return;

                const videoEl = videoRef?.current;
                if (!videoEl) {
                    logVideoStatus("missing");
                    return;
                }

                if (
                    videoEl.readyState < 2 ||
                    videoEl.videoWidth === 0 ||
                    videoEl.videoHeight === 0
                ) {
                    logVideoStatus("not-ready", {
                        readyState: videoEl.readyState,
                        width: videoEl.videoWidth,
                        height: videoEl.videoHeight
                    });
                    return;
                }

                logVideoStatus("ready");

                try {
                    let faceCount = 0;

                    if (usingNativeDetector && nativeDetector) {
                        logDetectorStatus("native");
                        const faces = await nativeDetector.detect(videoEl);
                        faceCount = Array.isArray(faces) ? faces.length : 0;
                        nativeErrorCount = 0;
                        fallbackErrorCount = 0;
                    } else if (tfFaceDetectorSingleton) {
                        logDetectorStatus(tfFaceDetectorRuntime || "tfjs");
                        const faces = await tfFaceDetectorSingleton.estimateFaces(videoEl, {
                            flipHorizontal: false
                        });
                        faceCount = Array.isArray(faces) ? faces.length : 0;
                        fallbackErrorCount = 0;
                    } else {
                        logDetectorStatus("none");
                        return;
                    }

                    if (lastFaceCount !== faceCount) {
                        console.log("[AntiCheat] Face count updated:", lastFaceCount, "->", faceCount);
                        lastFaceCount = faceCount;
                    }

                    const isCompliant = faceCount === 1;

                    if (isCompliant) {
                        if (lastState !== "ok") {
                            console.log("[AntiCheat] Single-person detection OK: exactly 1 face in frame.");
                        }
                        lastState = "ok";
                        lastViolationType = null;
                        lastViolationAt = null;
                        return;
                    }

                    const violationType = faceCount === 0 ? "no-face" : "multi-face";
                    const now = performance?.now ? performance.now() : Date.now();
                    const shouldRegister =
                        lastState !== "violation" ||
                        lastViolationType !== violationType ||
                        lastViolationAt == null ||
                        now - lastViolationAt >= intervalMs;

                    if (shouldRegister) {
                        console.warn("[AntiCheat] Face violation:", { violationType, faceCount, intervalMs });
                        registerViolation("MULTIPLE_FACES_DETECTED");
                        lastViolationAt = now;
                    }

                    lastState = "violation";
                    lastViolationType = violationType;
                } catch (err) {
                    console.warn("[AntiCheat] Face detection error:", err);

                    if (usingNativeDetector) {
                        nativeErrorCount += 1;
                        if (nativeErrorCount >= MAX_NATIVE_ERRORS) {
                            console.warn("[AntiCheat] Native FaceDetector failing; switching to fallback.");
                            nativeDetector = null;
                            usingNativeDetector = false;
                            await ensureFallbackDetector("native-failure");
                        }
                        return;
                    }

                    if (usingFallbackDetector) {
                        fallbackErrorCount += 1;

                        if (
                            fallbackErrorCount >= MAX_FALLBACK_ERRORS &&
                            tfFaceDetectorRuntime === "mediapipe" &&
                            !forceTfjsAttempted
                        ) {
                            console.warn("[AntiCheat] MediaPipe runtime failing; forcing TFJS backend.");
                            forceTfjsAttempted = true;
                            fallbackErrorCount = 0;
                            await ensureFallbackDetector("mediapipe-failure", { forceTfjs: true });
                            return;
                        }

                        if (fallbackErrorCount >= MAX_FALLBACK_ERRORS) {
                            console.warn("[AntiCheat] Fallback detector failing repeatedly; stopping detection.");
                            if (intervalId) {
                                window.clearInterval(intervalId);
                                intervalId = null;
                            }
                        }
                    }
                }
            }, intervalMs);
        };

        const init = async () => {
            if (typeof window === "undefined") return;

            // 1) Native FaceDetector only in secure context
            const FaceDetectorCtor = window.FaceDetector;
            if (FaceDetectorCtor && window.isSecureContext) {
                try {
                    nativeDetector = new FaceDetectorCtor({
                        fastMode: true,
                        maxDetectedFaces: 5
                    });
                    usingNativeDetector = true;
                    console.log("[AntiCheat] Using native FaceDetector for single-person check.");
                    await runDetectionLoop();
                    return;
                } catch (err) {
                    console.warn("[AntiCheat] Failed to construct FaceDetector:", err);
                    nativeDetector = null;
                    usingNativeDetector = false;
                }
            }

            // 2) Fallback detector (MediaPipe runtime only if env path exists; else TFJS)
            if (!loggedNoNativeFaceDetector) {
                console.log("[AntiCheat] Native FaceDetector not available; using fallback face detector.");
                loggedNoNativeFaceDetector = true;
            }

            try {
                const ready = await ensureFallbackDetector("initial");
                if (cancelled || !ready) return;
                await runDetectionLoop();
            } catch {
                console.warn("[AntiCheat] No working face detection backend; single-person detection disabled.");
            }
        };

        init();

        return () => {
            cancelled = true;
            if (intervalId) window.clearInterval(intervalId);

            if (usingFallbackDetector && fallbackReady) {
                tfFaceDetectorUsers = Math.max(0, tfFaceDetectorUsers - 1);
                if (tfFaceDetectorUsers === 0) {
                    disposeTfFaceDetector();
                }
            }
        };
    }, [isEnabled]);
}

/**
 * Hook: Multiple-voice detection (heuristic).
 * - Waits until audioContext and stream are actually ready before starting.
 */
export function useMultipleVoiceDetection({
    isEnabled,
    audioContextRef,
    audioStreamRef,
    detectionIntervalMs,
    registerViolation
}) {
    useEffect(() => {
        if (!isEnabled) return;

        let rafBootstrapId = null;
        let rafAnalyseId = null;
        let analyser = null;
        let sourceNode = null;
        let dataArray = null;

        let highEnergyEvents = 0;
        let windowStart = performance.now();

        const ENERGY_THRESHOLD = 0.35; // normalized 0..1
        const WINDOW_MS = detectionIntervalMs || 8000;
        const EVENTS_THRESHOLD = 12;

        const cleanupNodes = () => {
            try {
                if (sourceNode) sourceNode.disconnect();
                if (analyser) analyser.disconnect();
            } catch {
                // ignore
            }
            sourceNode = null;
            analyser = null;
        };

        const analyze = () => {
            try {
                analyser.getByteTimeDomainData(dataArray);
                let sumSquares = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const v = dataArray[i] - 128;
                    sumSquares += v * v;
                }
                const rms = Math.sqrt(sumSquares / dataArray.length) / 128;

                const now = performance.now();
                if (rms > ENERGY_THRESHOLD) {
                    highEnergyEvents++;
                }

                if (now - windowStart >= WINDOW_MS) {
                    if (highEnergyEvents >= EVENTS_THRESHOLD) {
                        console.log(
                            "[AntiCheat] High sustained audio energy detected -> MULTIPLE_VOICES_DETECTED",
                            { highEnergyEvents, windowMs: WINDOW_MS }
                        );
                        registerViolation("MULTIPLE_VOICES_DETECTED");
                    }
                    highEnergyEvents = 0;
                    windowStart = now;
                }

                rafAnalyseId = window.requestAnimationFrame(analyze);
            } catch (err) {
                console.warn("[AntiCheat] Multi-voice analyse error:", err);
                rafAnalyseId = window.requestAnimationFrame(analyze);
            }
        };

        const bootstrapWhenReady = () => {
            const audioCtx = audioContextRef?.current;
            const stream = audioStreamRef?.current;

            if (!audioCtx || !stream) {
                rafBootstrapId = window.requestAnimationFrame(bootstrapWhenReady);
                return;
            }

            try {
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 2048;
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);

                sourceNode = audioCtx.createMediaStreamSource(stream);
                sourceNode.connect(analyser);
            } catch (err) {
                console.warn("[AntiCheat] Failed to initialise multi-voice analyser:", err);
                cleanupNodes();
                return;
            }

            rafAnalyseId = window.requestAnimationFrame(analyze);
        };

        rafBootstrapId = window.requestAnimationFrame(bootstrapWhenReady);

        return () => {
            if (rafBootstrapId) window.cancelAnimationFrame(rafBootstrapId);
            if (rafAnalyseId) window.cancelAnimationFrame(rafAnalyseId);
            cleanupNodes();
        };
    }, [isEnabled, registerViolation, detectionIntervalMs]);
}
