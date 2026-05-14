/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState } from "react";
import CallScreen from "./CallScreen";
// import CallScreen from "./DemoMobileCall";
import { fetchData } from "../../AppUtils/dataAPI";
import MUICenterLayout from "../MUI/commonUI/MUICenterLayout";
import { useCallSimulationContextState } from "../../contexts/CallSimulationContext";
import { useUiContextState } from "../../contexts/UiContext";
import MUIAlert from "../MUI/commonUI/MUIAlert";

const NORMAL_CALL_MODE = "normal";
const MULTILINGUE_CALL_MODE = "Multilingual";

const normalizeCallMode = (mode) => {
    const rawMode = String(mode || "")
        .trim()
        .toLowerCase();
    if (
        ["Multilingual", "multilingue", "multilingual"].includes(rawMode)
    ) {
        return MULTILINGUE_CALL_MODE;
    }
    return NORMAL_CALL_MODE;
};

const appendQueryParam = (url, key, value) => {
    if (!url || !key || value === undefined || value === null || value === "") {
        return url;
    }
    const keyRegex = new RegExp(`([?&])${key}=`);
    if (keyRegex.test(url)) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${key}=${encodeURIComponent(value)}`;
};

export default function FakePlivoCall({
    answerUrlPath = "",
    triggerCallPath = "",
    CallScreen: givenCallScreen,
    centerLayoutSx,
}) {
    const [gState, setGState] = useCallSimulationContextState();
    const [, setUiState] = useUiContextState();

    const isProduction = (window?.location?.origin
        ?.toLowerCase?.()
        ?.includes?.("aiselekt.com") || window?.location?.origin
            ?.toLowerCase?.()
            ?.includes?.("hirexit.ai"));
    const isLocal =
        window?.location.origin?.toLowerCase?.()?.includes("localhost") ||
        window?.location.origin?.toLowerCase?.()?.includes("127.0.0.1");

    const CallScreenUI = givenCallScreen || CallScreen;

    const defaultJobId = isProduction
        ? "6927469930c53179d1444afa"
        : "69275dfb91a7281165e6d268";

    const candidateId = isProduction
        ? "69274c0d30c53179d1444b93"
        : "69275fa0ce85fcf258c76b29";

    // ✅ hard timeouts so reconnect doesn’t hang forever
    const HTTP_TIMEOUT_MS = 9000;
    const WS_OPEN_TIMEOUT_MS = 9000;
    const PLAYBACK_BUFFER_MS = 320;
    const PLAYBACK_FADE_MS = 6;

    let defaultValuesForGstate = {};

    const setAiCallDemoStatus = useCallback(
        (val) => setGState({ aiCallDemoStatus: val }),
        [setGState]
    );
    !gState?.aiCallDemoStatus &&
        (defaultValuesForGstate["aiCallDemoStatus"] = "AI Call");

    const setAiCallDemoMuted = (val) => {
        setGState({ aiCallDemoMuted: val });
        const track = gState.aiCallDemoMediaStreamRef?.current
            ?.getAudioTracks?.()?.[0];
        if (track) track.enabled = !val;
    };

    const setAiCallDemoIsSpeaking = useCallback(
        (val) => setGState({ aiCallDemoIsSpeaking: val }),
        [setGState]
    );

    const setAiCallDemoJobId = useCallback(
        (val) => setGState({ aiCallDemoJobId: val }),
        [setGState]
    );
    !gState?.aiCallDemoJobId &&
        (defaultValuesForGstate["aiCallDemoJobId"] = defaultJobId);

    const setAiCallDemoCandidateFirstName = useCallback(
        (val) => setGState({ aiCallDemoCandidateFirstName: val }),
        [setGState]
    );

    let aiCallDemoWsRef_ = useRef(null);
    !gState?.aiCallDemoWsRef &&
        (defaultValuesForGstate["aiCallDemoWsRef"] = aiCallDemoWsRef_);

    const aiCallDemoAudioCtxRef_ = useRef(null);
    !gState?.aiCallDemoAudioCtxRef &&
        (defaultValuesForGstate["aiCallDemoAudioCtxRef"] = aiCallDemoAudioCtxRef_);

    const aiCallDemoMediaStreamRef_ = useRef(null);
    !gState?.aiCallDemoMediaStreamRef &&
        (defaultValuesForGstate["aiCallDemoMediaStreamRef"] =
            aiCallDemoMediaStreamRef_);

    const aiCallDemoSourceRef_ = useRef(null);
    !gState?.aiCallDemoSourceRef &&
        (defaultValuesForGstate["aiCallDemoSourceRef"] = aiCallDemoSourceRef_);

    const aiCallDemoProcessorRef_ = useRef(null);
    !gState?.aiCallDemoProcessorRef &&
        (defaultValuesForGstate["aiCallDemoProcessorRef"] =
            aiCallDemoProcessorRef_);

    const aiCallDemoSilenceTimerRef_ = useRef(null);
    !gState?.aiCallDemoSilenceTimerRef &&
        (defaultValuesForGstate["aiCallDemoSilenceTimerRef"] =
            aiCallDemoSilenceTimerRef_);

    // const aiCallDemoCallIdRef_ = useRef(`call_simulation_____${Date.now()}`);
    // !gState?.aiCallDemoCallIdRef &&
    //     (defaultValuesForGstate["aiCallDemoCallIdRef"] = aiCallDemoCallIdRef_);

    const aiCallDemoStartedRef_ = useRef(false);
    !gState?.aiCallDemoStartedRef &&
        (defaultValuesForGstate["aiCallDemoStartedRef"] = aiCallDemoStartedRef_);

    const aiCallDemoConfigRef_ = useRef(null);
    !gState?.aiCallDemoConfigRef &&
        (defaultValuesForGstate["aiCallDemoConfigRef"] = aiCallDemoConfigRef_);

    const aiCallDemoActiveAudioSources_ = useRef([]);
    !gState?.aiCallDemoActiveAudioSources &&
        (defaultValuesForGstate["aiCallDemoActiveAudioSources"] =
            aiCallDemoActiveAudioSources_);

    const playbackStateRef = useRef({
        nextPlayTime: 0,
        started: false,
    });

    const resetPlaybackState = () => {
        playbackStateRef.current.nextPlayTime = 0;
        playbackStateRef.current.started = false;
    };

    // ✅ NEW: reconnect control
    const userEndedCallRef = useRef(false);
    const reconnectRef = useRef({
        attempts: 0,
        timer: null,
        inProgress: false,
        lastDemoEmail: null,
        lastCallMode: NORMAL_CALL_MODE,
        wsOpenTimer: null,
        lastCallUUID: null,
    });

    const [onAlert, setOnAlert] = useState({});

    useEffect(() => {
        if (Object.keys(defaultValuesForGstate)?.length > 0) {
            setGState(defaultValuesForGstate);
            defaultValuesForGstate = {};
        }
    }, [defaultValuesForGstate]);

    // ✅ NEW: cleanup on unmount so reconnect loop doesn’t run forever
    useEffect(() => {
        return () => {
            try {
                userEndedCallRef.current = true;

                if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);
                if (reconnectRef.current.wsOpenTimer)
                    clearTimeout(reconnectRef.current.wsOpenTimer);

                try {
                    gState?.aiCallDemoWsRef?.current?.close?.();
                } catch {
                    /* intentionally ignore ws close errors during unmount */
                }
            } catch {
                /* intentionally ignore teardown errors */
            }
        };
    }, []);

    const getTriggerCallPath = useCallback(
        (callId = null, callMode = NORMAL_CALL_MODE) => {
            let triggerCallPath_;
            const normalizedCallMode = normalizeCallMode(callMode);
            if (!triggerCallPath) {
                triggerCallPath_ =
                    window.location.origin +
                    "/api/ai/call/trigger/demo/" +
                    candidateId +
                    "/" +
                    gState?.aiCallDemoJobId +
                    "/?callUUID=" +
                    (callId ?? gState.aiCallDemoCallIdRef);
            } else {
                triggerCallPath_ = triggerCallPath;
            }
            triggerCallPath_ = appendQueryParam(
                triggerCallPath_,
                "callMode",
                normalizedCallMode
            );

            return [
                triggerCallPath_ || "",
                answerUrlPath ||
                triggerCallPath_
                    ?.replace?.("demo", "plivo")
                    ?.replace?.("trigger", "answer") ||
                "",
            ];
        },
        [
            answerUrlPath,
            candidateId,
            gState.aiCallDemoCallIdRef,
            gState?.aiCallDemoJobId,
            triggerCallPath,
        ]
    );

    const withTimeout = async (
        promiseFactory,
        timeoutMs,
        timeoutMessage = "Request timeout"
    ) => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            try {
                controller.abort();
            } catch {
                /* noop: abort may throw in older runtimes */
            }
        }, timeoutMs);

        try {
            return await promiseFactory(controller.signal);
        } catch (err) {
            if (err?.name === "AbortError") {
                const e = new Error(timeoutMessage);
                e.code = "TIMEOUT";
                throw e;
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    };

    // ---- Fetch + parse Answer URL XML ----
    const getPlivoXmlConfig = async (answerUrl, callUUID = null) => {
        // ✅ timeout-safe
        const res = await withTimeout(
            (signal) =>
                fetchData(answerUrl, {
                    method: "POST",
                    headers: { Accept: "application/xml" },
                    body: JSON.stringify({
                        RequestUUID: callUUID || gState.aiCallDemoCallIdRef,
                    }),
                    signal,
                }),
            HTTP_TIMEOUT_MS,
            "Answer URL call timed out"
        );
        return res;
    };

    const parseAnswerXml = (xmlString) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const streamEl = xmlDoc.querySelector("Stream");
        if (!streamEl) throw new Error("No <Stream> element found");

        const rateMatch = streamEl
            .getAttribute("contentType")
            .match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 8000;

        return {
            wssUrl: streamEl.textContent.trim(),
            bidirectional: streamEl.getAttribute("bidirectional") === "true",
            contentType: streamEl.getAttribute("contentType"),
            sampleRate,
            streamTimeout: parseInt(streamEl.getAttribute("streamTimeout"), 10),
            keepCallAlive: streamEl.getAttribute("keepCallAlive") === "true",
        };
    };

    const safeSend = (msg) => {
        if (
            gState?.aiCallDemoWsRef.current &&
            gState?.aiCallDemoWsRef.current.readyState === WebSocket.OPEN
        ) {
            gState?.aiCallDemoWsRef.current.send(JSON.stringify(msg));
        }
    };

    const sendStart = (callId = null) => {
        safeSend({
            event: "start",
            start: {
                callId: callId ?? gState.aiCallDemoCallIdRef,
                streamId: "browser-sim",
            },
        });
        gState.aiCallDemoStartedRef.current = true;
    };

    const sendStop = () => {
        if (gState.aiCallDemoStartedRef.current) {
            safeSend({
                event: "stop",
                stop: { callId: gState.aiCallDemoCallIdRef },
            });
            gState.aiCallDemoStartedRef.current = false;
        }
    };

    const encodeMulawSample = (s) => {
        const MU = 255;
        const sign = s < 0 ? 0x80 : 0;
        s = Math.min(Math.abs(s), 1);
        const mag = Math.log1p(MU * s) / Math.log1p(MU);
        const code = (mag * 127) | 0;
        return (~(sign | code)) & 0xff;
    };

    const float32ToMulaw = (float32Array) => {
        const len = float32Array.length;
        const result = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            result[i] = encodeMulawSample(float32Array[i]);
        }
        return result;
    };

    // ---- µ-law decode for incoming audio ----
    const mulawByteToSample = (mu) => {
        mu = (~mu) & 0xff;
        const sign = mu & 0x80;
        let exponent = (mu & 0x70) >> 4;
        let mantissa = mu & 0x0f;
        let sample = ((mantissa | 0x10) << (exponent + 3)) - 132;
        const pcm = sign ? -sample : sample;
        return pcm / 32768;
    };

    const mulawBase64ToFloat32 = (base64) => {
        const binary = atob(base64);
        const len = binary.length;
        const float32 = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            const mu = binary.charCodeAt(i) & 0xff;
            float32[i] = mulawByteToSample(mu);
        }
        return float32;
    };

    const resampleFloat32 = (input, srcRate, dstRate) => {
        if (!input?.length || srcRate === dstRate) return input;

        const ratio = dstRate / srcRate;
        const outLen = Math.max(1, Math.floor(input.length * ratio));
        const output = new Float32Array(outLen);

        for (let i = 0; i < outLen; i++) {
            const srcIndex = i / ratio;
            const leftIndex = Math.min(Math.floor(srcIndex), input.length - 1);
            const rightIndex = Math.min(leftIndex + 1, input.length - 1);
            const frac = srcIndex - leftIndex;
            output[i] =
                input[leftIndex] + (input[rightIndex] - input[leftIndex]) * frac;
        }

        return output;
    };

    const applyEdgeFade = (samples, sampleRate) => {
        if (!samples?.length || !sampleRate) return samples;

        const fadeSamples = Math.min(
            Math.floor(sampleRate * (PLAYBACK_FADE_MS / 1000)),
            Math.floor(samples.length / 2)
        );
        if (fadeSamples <= 1) return samples;

        for (let i = 0; i < fadeSamples; i++) {
            const gain = i / fadeSamples;
            samples[i] *= gain;
            const tailIndex = samples.length - 1 - i;
            samples[tailIndex] *= gain;
        }

        return samples;
    };

    const arrayBufferToBase64 = (buffer) => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(
                null,
                bytes.subarray(i, i + chunkSize)
            );
        }
        return btoa(binary);
    };

    const startMic = async (sampleRate, pauseDurationMs, keepAlive) => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        gState.aiCallDemoMediaStreamRef.current = stream;

        const track = stream.getAudioTracks()[0];
        track.enabled = !gState.aiCallDemoMuted;

        gState.aiCallDemoAudioCtxRef.current = new AudioContext({ sampleRate });
        gState.aiCallDemoSourceRef.current =
            gState.aiCallDemoAudioCtxRef.current.createMediaStreamSource(stream);
        gState.aiCallDemoProcessorRef.current =
            gState.aiCallDemoAudioCtxRef.current.createScriptProcessor(4096, 1, 1);

        const analyser = gState.aiCallDemoAudioCtxRef.current.createAnalyser();
        analyser.fftSize = 2048;
        const dataArray = new Uint8Array(analyser.fftSize);

        gState.aiCallDemoSourceRef.current.connect(analyser);
        analyser.connect(gState.aiCallDemoProcessorRef.current);
        gState.aiCallDemoProcessorRef.current.connect(
            gState.aiCallDemoAudioCtxRef.current.destination
        );

        gState.aiCallDemoProcessorRef.current.onaudioprocess = (e) => {
            if (gState?.aiCallDemoMuted) return;
            if (
                !gState?.aiCallDemoWsRef.current ||
                gState?.aiCallDemoWsRef.current.readyState !== WebSocket.OPEN
            )
                return;

            const input = e.inputBuffer.getChannelData(0);

            analyser.getByteTimeDomainData(dataArray);
            const rms =
                Math.sqrt(
                    dataArray.reduce((sum, v) => sum + (v - 128) ** 2, 0) /
                    dataArray.length
                ) / 128;

            if (rms < 0.02) {
                if (!gState.aiCallDemoSilenceTimerRef.current) {
                    gState.aiCallDemoSilenceTimerRef.current = Date.now();
                } else if (
                    Date.now() - gState.aiCallDemoSilenceTimerRef.current >
                    pauseDurationMs
                ) {
                    if (!keepAlive) {
                        sendStop();
                        gState?.aiCallDemoWsRef.current?.close();
                    }
                }
            } else {
                gState.aiCallDemoSilenceTimerRef.current = null;
            }

            const frameSize = Math.floor(sampleRate * 0.02);
            for (let i = 0; i < input.length; i += frameSize) {
                const slice = input.subarray(i, i + frameSize);
                const audBuf_ = float32ToMulaw(slice);
                const base64 = arrayBufferToBase64(audBuf_.buffer);
                safeSend({ event: "media", media: { payload: base64 } });
            }
        };
    };

    // ---- Stop mic ----
    const stopMic = async () => {
        try {
            gState.aiCallDemoMediaStreamRef.current?.getTracks().forEach((t) => t.stop());
            gState.aiCallDemoMediaStreamRef.current = null;

            gState.aiCallDemoProcessorRef.current?.disconnect();
            gState.aiCallDemoSourceRef.current?.disconnect();

            if (
                gState.aiCallDemoAudioCtxRef.current &&
                gState.aiCallDemoAudioCtxRef.current.state !== "closed"
            ) {
                await gState.aiCallDemoAudioCtxRef.current.close();
            }

            gState.aiCallDemoProcessorRef.current = null;
            gState.aiCallDemoSourceRef.current = null;
            gState.aiCallDemoAudioCtxRef.current = null;
        } catch (e) {
            console.error("[Call Simulation] Error stopping mic:", e);
        }
    };

    // ---- End call (manual) ----
    const endCall = () => {
        userEndedCallRef.current = true;

        reconnectRef.current.inProgress = false;
        reconnectRef.current.attempts = 0;
        reconnectRef.current.lastDemoEmail = null;
        reconnectRef.current.lastCallUUID = null;
        reconnectRef.current.lastCallMode = NORMAL_CALL_MODE;

        if (reconnectRef.current.timer) {
            clearTimeout(reconnectRef.current.timer);
            reconnectRef.current.timer = null;
        }
        if (reconnectRef.current.wsOpenTimer) {
            clearTimeout(reconnectRef.current.wsOpenTimer);
            reconnectRef.current.wsOpenTimer = null;
        }

        sendStop();
        stopMic();
        setAiCallDemoStatus("ended");
        setAiCallDemoIsSpeaking(false);

        if (gState?.aiCallDemoWsRef.current) {
            try {
                gState?.aiCallDemoWsRef?.current?.close();
            } catch {
                /* ignore ws close errors on manual end */
            }
            gState.aiCallDemoWsRef.current = null;
        }
        resetPlaybackState();
    };

    // ---- Incoming audio ----
    const handleIncomingAudio = async (msg) => {
        try {
            const data = JSON.parse(msg.data);

            if (data.event === "playAudio" && data.media?.payload) {
                const incomingSampleRate =
                    data.media.sampleRate ||
                    gState.aiCallDemoConfigRef.current?.sampleRate ||
                    8000;

                if (!gState.aiCallDemoAudioCtxRef.current) {
                    gState.aiCallDemoAudioCtxRef.current = new AudioContext({
                        sampleRate: incomingSampleRate,
                    });
                }
                const ctx = gState.aiCallDemoAudioCtxRef.current;
                const targetSampleRate = ctx.sampleRate || incomingSampleRate;

                let float32 = mulawBase64ToFloat32(data.media.payload);
                float32 = resampleFloat32(float32, incomingSampleRate, targetSampleRate);
                applyEdgeFade(float32, targetSampleRate);

                const audioBuffer = ctx.createBuffer(
                    1,
                    float32.length,
                    targetSampleRate
                );
                audioBuffer.getChannelData(0).set(float32);

                const src = ctx.createBufferSource();
                src.buffer = audioBuffer;
                src.connect(ctx.destination);

                const playbackState = playbackStateRef.current;
                const now = ctx.currentTime;
                if (!playbackState.started) {
                    playbackState.started = true;
                    playbackState.nextPlayTime = Math.max(
                        now + PLAYBACK_BUFFER_MS / 1000,
                        now + 0.02
                    );
                } else if (playbackState.nextPlayTime < now + 0.01) {
                    playbackState.nextPlayTime = now + 0.02;
                }

                const startAt = playbackState.nextPlayTime;
                src.start(startAt);
                playbackState.nextPlayTime = startAt + audioBuffer.duration;

                setAiCallDemoIsSpeaking(true);
                gState.aiCallDemoActiveAudioSources.current.push(src);
                src.onended = () => {
                    gState.aiCallDemoActiveAudioSources.current =
                        gState.aiCallDemoActiveAudioSources.current.filter(
                            (s) => s !== src
                        );
                    if (gState.aiCallDemoActiveAudioSources.current.length === 0) {
                        setAiCallDemoIsSpeaking(false);
                    }
                };
            }

            if (data.event === "clearAudio") {
                gState.aiCallDemoActiveAudioSources.current.forEach((src) => {
                    try {
                        src.stop();
                    } catch {
                        /* noop: stop can throw if already stopped */
                    }
                });
                gState.aiCallDemoActiveAudioSources.current = [];
                setAiCallDemoIsSpeaking(false);
                resetPlaybackState();
            }
        } catch (err) {
            console.error("[Call Simulation] Error handling incoming audio:", err);
        }
    };

    const scheduleReconnect = useCallback(
        (reason = "server restart") => {
            if (userEndedCallRef.current) return;

            setAiCallDemoStatus("reconnecting");
            setUiState({ loadingMsg: `Reconnecting live call (${reason} detected)...` });

            if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);

            const attempt = reconnectRef.current.attempts + 1;
            reconnectRef.current.attempts = attempt;

            const delay = Math.min(12000, 800 + attempt * 900);

            reconnectRef.current.timer = setTimeout(() => {
                if (userEndedCallRef.current) return;
                if (reconnectRef.current.inProgress) return;

                reconnectRef.current.inProgress = true;

                connectCallSession(
                    reconnectRef.current.lastDemoEmail,
                    true,
                    reconnectRef.current.lastCallUUID,
                    reconnectRef.current.lastCallMode
                )
                    .catch((err) => {
                        console.error("[Call Simulation] Reconnect attempt failed:", err);
                        scheduleReconnect(
                            err?.code === "TIMEOUT" ? "timeout" : "backend unavailable"
                        );
                    })
                    .finally(() => {
                        reconnectRef.current.inProgress = false;
                    });
            }, delay);
        },
        [setAiCallDemoStatus, setGState]
    );

    const connectCallSession = useCallback(
        async (
            demoEmail = null,
            isReconnect = false,
            callUUID = null,
            selectedCallMode = NORMAL_CALL_MODE
        ) => {
            const baseCallId = callUUID || gState?.aiCallDemoCallIdRef;
            const callId = demoEmail ? `${baseCallId} ${demoEmail}` : baseCallId;
            const resolvedCallMode = normalizeCallMode(
                selectedCallMode || reconnectRef.current.lastCallMode
            );
            reconnectRef.current.lastDemoEmail = demoEmail;
            if (callUUID) {
                reconnectRef.current.lastCallUUID = callUUID;
            }
            reconnectRef.current.lastCallMode = resolvedCallMode;
            try {
                if (!isReconnect) {
                    setAiCallDemoStatus("connecting");
                    setUiState({ loadingMsg: "Initiating a Live AI Call, Please wait..." });
                } else {
                    setAiCallDemoStatus("reconnecting");
                }

                console.log(
                    `[Call Simulation] ${isReconnect ? "Reconnecting" : "Triggering"} call in mode: ${resolvedCallMode}`
                );
                const [triggerCallPath_, answerUrlPath_] = getTriggerCallPath(
                    callId,
                    resolvedCallMode
                );
                // ✅ timeout-safe trigger
                await withTimeout(
                    (signal) =>
                        fetchData(
                            triggerCallPath_ +
                            (gState?.aiCallDemoCandidateFirstName
                                ? "&candidateFirstName=" + gState?.aiCallDemoCandidateFirstName
                                : ""),
                            { signal }
                        ),
                    HTTP_TIMEOUT_MS,
                    "Trigger call timed out"
                );

                if (!gState?.aiCallDemoCandidateFirstName) {
                    setAiCallDemoCandidateFirstName("Akash");
                }

                const xml = await getPlivoXmlConfig(answerUrlPath_, callId);
                const config = parseAnswerXml(xml);
                gState.aiCallDemoConfigRef.current = config;

                let wssUrl = isLocal
                    ? "ws://localhost:8080/api/ai/call/ws/plivo/" +
                    config.wssUrl.split("api/ai/call/ws/plivo/")[1]
                    : config.wssUrl;

                try {
                    gState.aiCallDemoWsRef.current?.close?.();
                } catch {
                    /* ignore old ws close errors */
                }
                gState.aiCallDemoWsRef.current = new WebSocket(wssUrl);

                if (reconnectRef.current.wsOpenTimer)
                    clearTimeout(reconnectRef.current.wsOpenTimer);
                reconnectRef.current.wsOpenTimer = setTimeout(() => {
                    try {
                        if (
                            gState.aiCallDemoWsRef.current &&
                            gState.aiCallDemoWsRef.current.readyState !== WebSocket.OPEN
                        ) {
                            try {
                                gState.aiCallDemoWsRef.current.close();
                            } catch {
                                /* noop */
                            }
                        }
                    } catch {
                        /* noop */
                    }
                }, WS_OPEN_TIMEOUT_MS);

                gState.aiCallDemoWsRef.current.onopen = async () => {
                    console.log("[Call Simulation] WS Connected");
                    userEndedCallRef.current = false;

                    if (reconnectRef.current.wsOpenTimer) {
                        clearTimeout(reconnectRef.current.wsOpenTimer);
                        reconnectRef.current.wsOpenTimer = null;
                    }

                    // reset reconnect tracking
                    reconnectRef.current.inProgress = false;
                    reconnectRef.current.attempts = 0;

                    // ✅ resume audio context if browser suspended it
                    try {
                        const ctx = gState.aiCallDemoAudioCtxRef.current;
                        if (ctx && ctx.state === "suspended") await ctx.resume();
                    } catch {
                        /* ignore audio resume errors */
                    }

                    sendStart(callId);

                    if (!gState.aiCallDemoMediaStreamRef.current) {
                        startMic(config.sampleRate, config.streamTimeout, config.keepCallAlive);
                    }

                    if (gState?.aiCallDemoStatus !== "in-call") setAiCallDemoStatus("in-call");
                    setUiState({ loadingMsg: null });
                };

                if (config.bidirectional) {
                    gState.aiCallDemoWsRef.current.onmessage = handleIncomingAudio;
                }

                gState.aiCallDemoWsRef.current.onerror = (e) => {
                    console.log("[Call Simulation] WS Error:", e);
                };

                gState.aiCallDemoWsRef.current.onclose = () => {
                    console.log("[Call Simulation] WS Closed");

                    if (reconnectRef.current.wsOpenTimer) {
                        clearTimeout(reconnectRef.current.wsOpenTimer);
                        reconnectRef.current.wsOpenTimer = null;
                    }

                    // If user ended it, do normal end cleanup.
                    if (userEndedCallRef.current) {
                        endCall();
                        return;
                    }

                    // Otherwise, keep retrying until backend is back.
                    scheduleReconnect("server restart");
                };

                return true;
            } catch (err) {
                console.error(
                    `[Call Simulation] Failed to ${isReconnect ? "reconnect" : "trigger"} call in mode=${reconnectRef.current.lastCallMode}:`,
                    err
                );
                // If we are reconnecting, keep retrying. If initial connect fails, surface alert.
                if (isReconnect && !userEndedCallRef.current) {
                    scheduleReconnect(err?.code === "TIMEOUT" ? "timeout" : "backend unavailable");
                    return false;
                }
                throw err;
            } finally {
                if (!isReconnect) {
                    setUiState({ loadingMsg: null });
                    setGState({ demoMailGiven: demoEmail });
                }
            }
        },
        [
            gState?.aiCallDemoCallIdRef,
            gState?.aiCallDemoCandidateFirstName,
            gState?.aiCallDemoStatus,
            gState.aiCallDemoAudioCtxRef,
            gState.aiCallDemoConfigRef,
            gState.aiCallDemoMediaStreamRef,
            gState.aiCallDemoWsRef,
            getTriggerCallPath,
            isLocal,
            scheduleReconnect,
            setAiCallDemoCandidateFirstName,
            setAiCallDemoStatus,
            setGState,
        ]
    );

    const triggerCall = useCallback(
        async (demoEmail = null, selectedCallMode = NORMAL_CALL_MODE) => {
            try {
                const callUUID = `call_simulation_____${Date.now()}`;
                const resolvedCallMode = normalizeCallMode(selectedCallMode);
                reconnectRef.current.lastDemoEmail = demoEmail;
                reconnectRef.current.lastCallUUID = callUUID;
                userEndedCallRef.current = false;
                reconnectRef.current.lastCallMode = resolvedCallMode;
                setGState({ aiCallDemoCallIdRef: callUUID });

                await connectCallSession(
                    demoEmail,
                    false,
                    callUUID,
                    resolvedCallMode
                );
            } catch (err) {
                setGState({ aiCallDemoStatus: "AI Call" });
                setOnAlert({
                    message:
                        "[Call Simulation] Error in triggering Call: " +
                        (err?.message || err?.statusText || err),
                    open: true,
                });
            }
            // ✅ removed redundant finally setGState here (handled in connectCallSession)
        },
        [connectCallSession, setGState]
    );

    const handleAlertClose = (_, reason) => {
        if (reason === "clickaway") return;
        setOnAlert((a) => ({ ...a, open: false }));
    };

    return (
        <>
            {givenCallScreen ? (
                <CallScreenUI
                    key={`${gState?.aiCallDemoJobId}___${candidateId}`}
                    status={gState?.aiCallDemoStatus}
                    triggerCall={triggerCall}
                    onEnd={endCall}
                    onToggleMute={(newMuted) => setAiCallDemoMuted(newMuted)}
                    speaking={gState?.aiCallDemoIsSpeaking}
                    playing={gState?.aiCallDemoIsSpeaking}
                    jobId={gState?.aiCallDemoJobId}
                    setJobId={setAiCallDemoJobId}
                    candidateId={candidateId}
                    callUUID={
                        gState?.demoMailGiven
                            ? `${gState?.aiCallDemoCallIdRef} ${gState?.demoMailGiven}`
                            : gState?.aiCallDemoCallIdRef
                    }
                    candidateFirstName={gState?.aiCallDemoCandidateFirstName}
                    setCandidateFirstName={setAiCallDemoCandidateFirstName}
                />
            ) : (
                <MUICenterLayout sx={centerLayoutSx}>
                    <CallScreenUI
                        key={`${gState?.aiCallDemoJobId}___${candidateId}`}
                        status={gState?.aiCallDemoStatus}
                        triggerCall={triggerCall}
                        onEnd={endCall}
                        onToggleMute={(newMuted) => setAiCallDemoMuted(newMuted)}
                        speaking={gState?.aiCallDemoIsSpeaking}
                        playing={gState?.aiCallDemoIsSpeaking}
                        jobId={gState?.aiCallDemoJobId}
                        setJobId={setAiCallDemoJobId}
                        candidateId={candidateId}
                        callUUID={
                            gState?.demoMailGiven
                                ? `${gState?.aiCallDemoCallIdRef} ${gState?.demoMailGiven}`
                                : gState?.aiCallDemoCallIdRef
                        }
                        candidateFirstName={gState?.aiCallDemoCandidateFirstName}
                        setCandidateFirstName={setAiCallDemoCandidateFirstName}
                    />
                </MUICenterLayout>
            )}

            <MUIAlert
                open={onAlert?.open}
                message={onAlert?.message}
                severity={onAlert?.severity || "error"}
                onClose={handleAlertClose}
            />
        </>
    );
}
