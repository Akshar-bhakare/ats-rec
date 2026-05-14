// backend/src/utils/deepgramSTTUtils.js
import { DeepgramClient } from "@deepgram/sdk";

const deepgramApiKey = process.env.DEEPGRAM_API_KEY || "";
const deepgramClient = deepgramApiKey
    ? new DeepgramClient({ apiKey: deepgramApiKey })
    : null;

const BASE64_MARKER = "base64,";
const MIN_AUDIO_BYTES = 1500;
const MAX_BASE64_CHARS = Number(process.env.DEEPGRAM_MAX_BASE64_CHARS) || 80 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = Number(process.env.DEEPGRAM_TIMEOUT_MS) || 30000;
const MAX_RETRIES = Number(process.env.DEEPGRAM_MAX_RETRIES) || 1;
const RETRY_BASE_DELAY_MS = Number(process.env.DEEPGRAM_RETRY_DELAY_MS) || 400;
const DEFAULT_PRERECORDED_LANGUAGE = String(
    process.env.DEEPGRAM_PRERECORDED_DEFAULT_LANGUAGE || "en"
)
    .trim()
    .toLowerCase();

function normalizeLanguageCode(language, fallback = DEFAULT_PRERECORDED_LANGUAGE) {
    const normalized = String(language || "")
        .trim()
        .toLowerCase();
    return normalized || fallback || "en";
}

function getMimeTypeFromDataUri(dataUri) {
    if (typeof dataUri !== "string") return null;
    const match = dataUri.match(/^data:([^;,]+)[;,]/i);
    return match ? match[1].toLowerCase() : null;
}

function extractBase64Audio(audioData) {
    if (typeof audioData !== "string") {
        throw new Error("audioData must be a base64 data URI string");
    }

    const trimmed = audioData.trim();
    if (!trimmed) {
        throw new Error("audioData is empty");
    }

    let base64Data = "";

    if (trimmed.startsWith("data:")) {
        const idx = trimmed.indexOf(BASE64_MARKER);
        if (idx === -1) {
            throw new Error("Invalid data URI: missing base64 marker");
        }
        base64Data = trimmed.slice(idx + BASE64_MARKER.length);
    } else if (trimmed.includes(BASE64_MARKER)) {
        const idx = trimmed.indexOf(BASE64_MARKER);
        base64Data = trimmed.slice(idx + BASE64_MARKER.length);
    } else {
        // Allow raw base64 input as a fallback.
        base64Data = trimmed;
    }

    const sanitized = base64Data.replace(/\s/g, "");
    if (!sanitized) {
        throw new Error("Invalid base64 audio: empty payload");
    }

    if (sanitized.length > MAX_BASE64_CHARS) {
        throw new Error(`Audio payload too large (${sanitized.length} base64 chars)`);
    }

    if (!/^[A-Za-z0-9+/=]+$/.test(sanitized)) {
        throw new Error("Invalid base64 audio: contains non-base64 characters");
    }

    return sanitized;
}

function decodeBase64Audio(base64Data) {
    let buffer;
    try {
        buffer = Buffer.from(base64Data, "base64");
    } catch (err) {
        throw new Error("Failed to decode base64 audio");
    }

    if (!buffer || buffer.length === 0) {
        throw new Error("Decoded audio buffer is empty");
    }

    return buffer;
}

function getStatusFromError(error) {
    if (!error || typeof error !== "object") return null;
    return (
        error.status ||
        error.statusCode ||
        error?.response?.status ||
        error?.response?.statusCode ||
        null
    );
}

function isRetryableStatus(status) {
    if (!status) return false;
    return status === 429 || (status >= 500 && status <= 599);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms) {
    if (!ms || ms <= 0) return promise;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Deepgram request timed out after ${ms}ms`));
        }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });
}

async function requestTranscriptionWithRetry(audioBuffer, options) {
    let attempt = 0;
    const totalAttempts = Math.max(1, MAX_RETRIES + 1);

    while (attempt < totalAttempts) {
        attempt += 1;

        try {
            return await withTimeout(
                deepgramClient.listen.v1.media.transcribeFile(audioBuffer, options),
                REQUEST_TIMEOUT_MS
            );
        } catch (err) {
            const status = getStatusFromError(err);
            if (isRetryableStatus(status) && attempt < totalAttempts) {
                const delayMs = RETRY_BASE_DELAY_MS * attempt;
                console.warn(
                    `⚠️ [STT][DG] Retry ${attempt}/${totalAttempts - 1} after ${delayMs}ms (status=${status})`
                );
                await delay(delayMs);
                continue;
            }
            throw err;
        }
    }

    return null;
}

/**
 * Deepgram STT for WebRTC audio (audio/webm;codecs=opus from the browser).
 * Accepts a data URI (data:audio/webm;base64,...) just like the Google STT util.
 */
export async function transcribeAudioWithDeepgram(audioData, options = {}) {
    const t0 = Date.now();
    console.log("\n🎧 [STT][DG] ============== transcribeAudioWithDeepgram() START ==============");

    try {
        if (!deepgramClient) {
            throw new Error("DEEPGRAM_API_KEY is not configured");
        }

        if (!audioData || typeof audioData !== "string") {
            throw new Error("No audio data received.");
        }

        console.log("🔎 [STT][DG] Raw prefix:", audioData.slice(0, 64));

        const mimeType = getMimeTypeFromDataUri(audioData);
        if (mimeType && !mimeType.startsWith("audio/")) {
            throw new Error(`Unsupported media type: ${mimeType}`);
        }

        const base64Data = extractBase64Audio(audioData);
        const audioBuffer = decodeBase64Audio(base64Data);
        console.log("📦 [STT][DG] Audio buffer bytes:", audioBuffer.length);

        if (audioBuffer.length < MIN_AUDIO_BYTES) {
            console.warn("⚠️ [STT][DG] Buffer too small; likely silence or bad payload.");
            return "";
        }

        // Deepgram pre-recorded transcription
        console.log("📡 [STT][DG] Sending audio to Deepgram (pre-recorded)...");
        const requestedLanguage =
            typeof options === "string"
                ? options
                : options && typeof options === "object"
                    ? options.language
                    : null;
        const finalLanguage = normalizeLanguageCode(requestedLanguage);

        let response;
        try {
            response = await requestTranscriptionWithRetry(audioBuffer, {
                // WebRTC recordings from your React component are audio/webm;codecs=opus
                mimetype: mimeType || "audio/webm",
                model: "nova-3",
                smart_format: true,
                language: finalLanguage,
                punctuate: true,
            });
        } catch (err) {
            console.error("❌ [STT][DG] Deepgram request failed:", err?.message || err);
            throw err;
        }

        const { data } = response || {};

        const transcript =
            data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

        const finalText = (transcript || "").trim();
        if (!finalText) {
            console.warn("⚠️ [STT][DG] Transcript empty with no reported error.");
        }
        console.log("📝 [STT][DG] Transcribed text:", finalText || "(empty)");
        console.log("✅ [STT][DG] DONE in", Date.now() - t0, "ms");

        return finalText;
    } catch (err) {
        console.error("❌ [STT][DG] Error:", err?.message || err);
        console.log("🏁 [STT][DG] FAILED in", Date.now() - t0, "ms");
        // For WebRTC UX, better to return empty string than explode the route
        return "";
    }
}
