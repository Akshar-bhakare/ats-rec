// ../../utils/elevenLabsTTSUtils.js

import fs from "fs";
import path from "path";
import { ttsMediaTempDir } from "../../server.js";
import { sanitizeFileName } from "./fileIOUtils.js";

// ================== ENV & COMMON HELPERS ==================

const envArr = [
    // "local",
    // "production",
    // "development",
];

function now() {
    return Date.now();
}

function durMs(t0) {
    return `${(Date.now() - t0).toFixed(0)}ms`;
}

function ensureDirSafe(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    } catch (e) {
        console.log("⚠️ [FS] Failed to ensure dir:", dirPath, "|", e?.message || e);
        return false;
    }
}

// ================== AUDIO HELPERS ==================

export function addSilencePadding(
    buffer,
    sampleRate = 8000,
    durationMs = 100
) {
    const bytesPerSample = 1;
    const numSilentSamples = Math.floor(sampleRate * (durationMs / 1000));
    const silence = Buffer.alloc(numSilentSamples * bytesPerSample, 0xff);
    return Buffer.concat([silence, buffer, silence]);
}

/**
 * Strip RIFF/WAVE container header and return only the raw "data" chunk
 * (used to get pure μ-law bytes for telephony).
 */
export function ensureRawMulaw(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 64) return buffer;

    const riff = buffer.slice(0, 4).toString("ascii");
    const wave = buffer.slice(8, 12).toString("ascii");

    if (riff !== "RIFF" || wave !== "WAVE") {
        return buffer;
    }

    try {
        let offset = 12; // after RIFF xxxx WAVE
        while (offset + 8 <= buffer.length) {
            const chunkId = buffer.slice(offset, offset + 4).toString("ascii");
            const chunkSize = buffer.readUInt32LE(offset + 4);
            offset += 8;

            if (chunkId === "data") {
                if (offset + chunkSize > buffer.length) {
                    return buffer.slice(offset);
                }
                return buffer.slice(offset, offset + chunkSize);
            }

            offset += chunkSize;
        }
    } catch (err) {
        console.log(
            "[TextToSpeech] Failed to strip WAV header, using original buffer:",
            err
        );
    }

    return buffer;
}

// (Kept for future use; not strictly required right now)
function linear16ToMulawSample(sample) {
    if (sample > 32767) sample = 32767;
    if (sample < -32768) sample = -32768;

    const BIAS = 0x84;
    const MAX = 32635;

    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > MAX) sample = MAX;
    sample = sample + BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
        exponent--;
    }

    const mantissa =
        (sample >> ((exponent === 0 ? 4 : exponent + 3))) & 0x0f;
    let ulawByte = ~(sign | (exponent << 4) | mantissa);
    ulawByte &= 0xff;
    return ulawByte;
}

function pcm16ToMulaw8k(pcmBuffer, inputSampleRate = 16000) {
    if (!Buffer.isBuffer(pcmBuffer) || pcmBuffer.length < 2) {
        return Buffer.alloc(0);
    }

    const targetSampleRate = 8000;

    const bytesPerSample = 2;
    const totalSamples = Math.floor(pcmBuffer.length / bytesPerSample);

    let step = inputSampleRate / targetSampleRate;
    if (!Number.isFinite(step) || step <= 0) step = 2;

    const outSamples = Math.floor(totalSamples / step);
    const out = Buffer.alloc(outSamples);

    let outIdx = 0;
    for (let i = 0; i < totalSamples && outIdx < outSamples; i += step) {
        const idx = Math.floor(i);
        const sample = pcmBuffer.readInt16LE(idx * bytesPerSample);
        out[outIdx++] = linear16ToMulawSample(sample);
    }

    return out;
}

// ================== ELEVENLABS CONFIG ==================

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const ELEVEN_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || undefined;

// ================== ELEVENLABS CORE CALL ==================

async function elevenLabsTextToSpeech(
    text,
    languageCode = 'en-IN',
    ssmlGender = 'FEMALE',
    voiceName = 'en-IN-Chirp-HD-F',
    audioEncoding = 'MULAW',
    sampleRateHertz = 8000,
    speakingRate = 1.0,
) {
    if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID) {
        console.log(
            "[TextToSpeech][11labs] Skipping ElevenLabs: ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID missing."
        );
        throw new Error("ELEVENLABS_MISCONFIGURED");
    }

    if (typeof fetch !== "function") {
        console.log(
            "[TextToSpeech][11labs] Skipping ElevenLabs: global fetch not available in this Node runtime."
        );
        throw new Error("ELEVENLABS_FETCH_UNAVAILABLE");
    }

    let elevenOutputFormat;

    if (audioEncoding === "MULAW") {
        // What you asked for: ElevenLabs "ulaw_8000"
        elevenOutputFormat = "ulaw_8000";
    } else if (audioEncoding === "LINEAR16") {
        if (sampleRateHertz === 8000) elevenOutputFormat = "pcm_8000";
        else if (sampleRateHertz === 16000) elevenOutputFormat = "pcm_16000";
        else if (sampleRateHertz === 22050) elevenOutputFormat = "pcm_22050";
        else if (sampleRateHertz === 24000) elevenOutputFormat = "pcm_24000";
        else elevenOutputFormat = "pcm_44100";
    } else {
        elevenOutputFormat = "mp3_44100_128";
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}?output_format=${encodeURIComponent(
        elevenOutputFormat
    )}`;

    const body = {
        text,
        ...(ELEVEN_MODEL_ID ? { model_id: ELEVEN_MODEL_ID } : {}),
        voice_settings: {
            stability: 0.6,
            similarity_boost: 0.85,
        },
    };

    const t0 = now();
    console.log("[TextToSpeech][11labs] Requesting TTS from ElevenLabs...", {
        elevenOutputFormat,
        languageCode,
        audioEncoding,
        sampleRateHertz,
    });

    let res;
    try {
        res = await fetch(url, {
            method: "POST",
            headers: {
                "xi-api-key": ELEVEN_API_KEY,
                "Content-Type": "application/json",
                Accept: "*/*",
            },
            body: JSON.stringify(body),
        });
    } catch (networkErr) {
        console.log(
            "[TextToSpeech][11labs] Network/connection error:",
            networkErr?.message || networkErr
        );
        throw new Error(
            `ELEVENLABS_NETWORK_ERROR: ${networkErr?.message || networkErr}`
        );
    }

    const latency = durMs(t0);

    if (!res.ok) {
        let errText = "";
        try {
            errText = await res.text();
        } catch (_) { }

        console.log(
            `[TextToSpeech][11labs] Failed (${res.status} ${res.statusText}) in ${latency}:`,
            errText || "<no body>"
        );

        if (
            res.status === 401 ||
            res.status === 403 ||
            (errText && errText.includes("missing_permissions"))
        ) {
            const e = new Error(
                `ELEVENLABS_AUTH_OR_PERMISSIONS_ERROR: ${errText}`
            );
            e.code = "ELEVENLABS_MISSING_PERMISSIONS";
            throw e;
        }

        throw new Error(`ELEVENLABS_TTS_ERROR: ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    let audioBuffer = Buffer.from(arrayBuffer);

    console.log(
        `[TextToSpeech][11labs] Raw ElevenLabs response in ${latency} | bytes=${audioBuffer.length} | format=${elevenOutputFormat}`
    );

    if (audioEncoding === "MULAW") {
        // ElevenLabs ulaw_8000 is typically WAV/RIFF wrapped.
        const rawMulaw = ensureRawMulaw(audioBuffer);
        console.log(
            `[TextToSpeech][11labs] Stripped WAV header for μ-law | inBytes=${audioBuffer.length} | outBytes=${rawMulaw.length}`
        );
        return rawMulaw;
    }

    return audioBuffer;
}

// ================== PUBLIC API: universalTextToSpeech ==================

/**
 * ElevenLabs-only Text-to-Speech.
 *
 * @param {string} text
 * @param {string} languageCode
 * @param {'FEMALE'|'MALE'|'NEUTRAL'} ssmlGender
 * @param {string} voiceName
 * @param {'MP3'|'LINEAR16'|'OGG_OPUS'|'MULAW'} audioEncoding
 * @param {number} sampleRateHertz
 * @param {number} speakingRate
 * @returns {Promise<Buffer>}
 */
export async function universalTextToSpeech(
    text = "AI Call testing audio",
    languageCode = "en-IN",
    ssmlGender = "FEMALE",
    voiceName = "en-IN-Chirp-HD-F",
    audioEncoding = "MULAW",
    sampleRateHertz = 8000,
    speakingRate = 1.0
) {
    const safeText = typeof text === "string" ? text : String(text || "");
    const shortText = safeText.slice(0, 60).replace(/\s+/g, " ");

    console.log(
        `\n📢 [TextToSpeech] universalTextToSpeech() called | text="${shortText}${safeText.length > 60 ? "..." : ""
        }"`,
        {
            languageCode,
            ssmlGender,
            voiceName,
            audioEncoding,
            sampleRateHertz,
            speakingRate,
        }
    );

    const cacheFileName = sanitizeFileName(
        `tts ${languageCode} ${ssmlGender} ${voiceName} ${audioEncoding} ${sampleRateHertz} ${speakingRate} ${safeText.replaceAll(
            " ",
            ""
        )}.raw`
    );
    const cacheFilePath = path.join(ttsMediaTempDir, cacheFileName);

    if (envArr.includes(process?.env?.NODE_ENV)) {
        ensureDirSafe(ttsMediaTempDir);
    }

    // -------- OPTIONAL DISK CACHE (ElevenLabs only) --------
    if (envArr.includes(process?.env?.NODE_ENV)) {
        try {
            const fls = fs.readdirSync(ttsMediaTempDir) || [];
            const cacheFileExists = fls.includes(cacheFileName);
            if (cacheFileExists) {
                console.log(
                    `[TextToSpeech][Cache] Hit for "${shortText}" -> ${cacheFileName}`
                );
                return fs.readFileSync(cacheFilePath);
            }
        } catch (err) {
            console.log(
                "\n [TextToSpeech][Cache] ❌ Error while checking cache file: ",
                err,
                "\n"
            );
        }
    }

    // -------- ELEVENLABS (NO GOOGLE FALLBACK) --------
    const t0 = now();
    const elevenBuf = await elevenLabsTextToSpeech(
        safeText,
        languageCode,
        ssmlGender,
        voiceName,
        audioEncoding,
        sampleRateHertz,
        speakingRate
    );

    if (!elevenBuf || !elevenBuf.length) {
        const msg =
            "[TextToSpeech][11labs] Empty buffer received from ElevenLabs (no Google fallback configured).";
        console.log(msg);
        throw new Error("ELEVENLABS_EMPTY_AUDIO");
    }

    console.log(
        `[TextToSpeech][11labs] Using ElevenLabs audio for "${shortText}" | bytes=${elevenBuf.length} | total=${durMs(
            t0
        )}`
    );

    if (
        elevenBuf.length &&
        cacheFileName?.length <= 255 &&
        envArr.includes(process?.env?.NODE_ENV)
    ) {
        (async () => {
            try {
                fs.writeFileSync(cacheFilePath, elevenBuf);
                console.log(
                    "[TextToSpeech][Cache] Saved ElevenLabs result to disk:",
                    cacheFileName
                );
            } catch (err) {
                console.log(
                    "\n [TextToSpeech][Cache] ❌ Error writing ElevenLabs cache file: ",
                    err,
                    "\n"
                );
            }
        })();
    }

    return elevenBuf;
}

export default universalTextToSpeech;
