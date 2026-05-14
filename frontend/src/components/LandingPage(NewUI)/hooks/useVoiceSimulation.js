import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchData } from '../../../AppUtils/dataAPI';

// µ-law utilities from FakePlivoCall logic
const encodeMulawSample = (s) => {
    const MU = 255;
    const sign = s < 0 ? 0x80 : 0;
    s = Math.min(Math.abs(s), 1);
    const mag = Math.log1p(MU * s) / Math.log1p(MU);
    const code = (mag * 127) | 0;
    return (~(sign | code)) & 0xff;
};

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
        output[i] = input[leftIndex] + (input[rightIndex] - input[leftIndex]) * frac;
    }
    return output;
};

export const useVoiceSimulation = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [status, setStatus] = useState('Ready');
    const [isMuted, setIsMuted] = useState(false);

    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const streamRef = useRef(null);
    const processorRef = useRef(null);
    const sourceRef = useRef(null);
    const nextPlayTimeRef = useRef(0);
    const callUUIDRef = useRef(null);
    const configRef = useRef(null);
    const activeAudioSourcesRef = useRef([]);

    const HTTP_TIMEOUT_MS = 10000;
    const PLAYBACK_BUFFER_MS = 100;

    const parseAnswerXml = (xmlString) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const streamEl = xmlDoc.querySelector("Stream");
        if (!streamEl) throw new Error("No <Stream> element found");
        const rateMatch = streamEl.getAttribute("contentType").match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 8000;
        return {
            wssUrl: streamEl.textContent.trim(),
            bidirectional: streamEl.getAttribute("bidirectional") === "true",
            sampleRate,
            streamTimeout: parseInt(streamEl.getAttribute("streamTimeout"), 10),
            keepCallAlive: streamEl.getAttribute("keepCallAlive") === "true",
        };
    };

    const handleIncomingAudio = useCallback((event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === "playAudio" && data.media?.payload) {
                const incomingRate = data.media.sampleRate || configRef.current?.sampleRate || 8000;

                if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
                }
                const ctx = audioContextRef.current;
                const targetRate = ctx.sampleRate; // This will likely be 44100

                let float32 = mulawBase64ToFloat32(data.media.payload);
                float32 = resampleFloat32(float32, incomingRate, targetRate);

                const audioBuffer = ctx.createBuffer(1, float32.length, targetRate);
                audioBuffer.getChannelData(0).set(float32);

                const src = ctx.createBufferSource();
                src.buffer = audioBuffer;
                src.connect(ctx.destination);

                const now = ctx.currentTime;
                if (nextPlayTimeRef.current < now + 0.01) {
                    nextPlayTimeRef.current = now + PLAYBACK_BUFFER_MS / 1000;
                }

                const startAt = nextPlayTimeRef.current;
                src.start(startAt);
                nextPlayTimeRef.current = startAt + audioBuffer.duration;
                activeAudioSourcesRef.current.push(src);
                src.onended = () => {
                    activeAudioSourcesRef.current = activeAudioSourcesRef.current.filter(s => s !== src);
                };
            } else if (data.event === "clearAudio") {
                activeAudioSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
                activeAudioSourcesRef.current = [];
                nextPlayTimeRef.current = 0;
            }
        } catch (err) {
            console.error("Audio Processing Error:", err);
        }
    }, []);

    const endCall = useCallback(() => {
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ event: 'stop', stop: { callId: callUUIDRef.current } }));
            }
            wsRef.current.onclose = null;
            wsRef.current.close();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        wsRef.current = null;
        callUUIDRef.current = null;
        setIsConnected(false);
        setStatus('Call Ended');
    }, []);

    const startMic = async (sampleRate) => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        }
        const ctx = audioContextRef.current;
        sourceRef.current = ctx.createMediaStreamSource(stream);
        processorRef.current = ctx.createScriptProcessor(4096, 1, 1);

        const frameSize = Math.floor(sampleRate * 0.02); // 20ms frame size
        let leftover = [];

        processorRef.current.onaudioprocess = (e) => {
            if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            const input = e.inputBuffer.getChannelData(0);
            const resampled = resampleFloat32(input, ctx.sampleRate, sampleRate);

            // Combine with leftover samples from previous buffer
            const allSamples = [...leftover, ...resampled];

            let i = 0;
            while (i + frameSize <= allSamples.length) {
                const frame = allSamples.slice(i, i + frameSize);
                const mulaw = new Uint8Array(frameSize);
                for (let j = 0; j < frameSize; j++) {
                    mulaw[j] = encodeMulawSample(frame[j]);
                }
                const payload = btoa(String.fromCharCode.apply(null, mulaw));
                wsRef.current.send(JSON.stringify({ event: 'media', media: { payload } }));
                i += frameSize;
            }
            leftover = allSamples.slice(i);
        };

        sourceRef.current.connect(processorRef.current);
        processorRef.current.connect(ctx.destination);
    };

    const startCall = useCallback(async (candidateId, jobId, customCallUUID = null, callMode = 'normal', candidateFirstName = 'Candidate') => {
        try {
            setStatus('Connecting...');

            // Create AudioContext immediately on user gesture to prevent suspension
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
            }
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const callUUID = customCallUUID || `call_simulation_____${Date.now()}`;
            callUUIDRef.current = callUUID;

            const baseApiUrl = ""; // Use relative path to avoid CORS issues and use Vite proxy
            // Construct trigger URL with exact parameters from logs
            const triggerUrl = `${baseApiUrl}/api/ai/call/trigger/demo/${candidateId}/${jobId}/?callUUID=${encodeURIComponent(callUUID)}&callMode=${callMode}&candidateFirstName=${encodeURIComponent(candidateFirstName)}`;

            console.log("Triggering AI Call:", triggerUrl);
            await fetchData(triggerUrl, { method: "GET" });

            const answerUrl = `/api/ai/call/answer/plivo/${candidateId}/${jobId}/?callUUID=${encodeURIComponent(callUUID)}&callMode=${callMode}`;
            const xml = await fetchData(answerUrl, {
                method: "POST",
                headers: { Accept: "application/xml" },
                body: { RequestUUID: callUUID }
            });

            console.log("AI Call Answer XML:", xml);
            const config = parseAnswerXml(xml);
            configRef.current = config;

            const isProduction = (window?.location?.origin
                ?.toLowerCase?.()
                ?.includes?.("aiselekt.com") || window?.location?.origin
                    ?.toLowerCase?.()
                    ?.includes?.("hirexit.ai"));

            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            let wsUrl = config.wssUrl;

            if (isLocal && (wsUrl.includes("aiselekt.com") || wsUrl.includes("hirexit.ai"))) {
                wsUrl = wsUrl.replace("https://hirexit.ai", "ws://localhost:8080")
                    .replace("wss://aiselekt.com", "ws://localhost:8080")
                    .replace("https://hirexit.ai", "ws://localhost:8080")
                    .replace("wss://hirexit.ai", "ws://localhost:8080");
            }

            console.log("Connecting to WS:", wsUrl);
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = async () => {
                setIsConnected(true);
                setStatus('In Call');
                wsRef.current.send(JSON.stringify({
                    event: 'start',
                    start: {
                        callId: callUUID,
                        streamId: 'browser-sim'
                    }
                }));

                await startMic(config.sampleRate);
            };

            if (config.bidirectional) {
                wsRef.current.onmessage = handleIncomingAudio;
            }

            wsRef.current.onclose = () => {
                setIsConnected(false);
                if (callUUIDRef.current) setStatus('Call Ended');
            };

            return callUUID;
        } catch (error) {
            console.error('Call Execution Error:', error);
            setStatus('Error');
            setIsConnected(false);
            throw error;
        }
    }, [handleIncomingAudio, isMuted]);

    useEffect(() => {
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(() => { });
            }
        };
    }, []);

    return { isConnected, status, isMuted, setIsMuted, startCall, endCall };
};
