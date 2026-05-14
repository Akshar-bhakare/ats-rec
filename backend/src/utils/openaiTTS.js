// openaiTTS.js

import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const DEFAULT_OPENAI_VOICE =
    (process.env.OPENAI_TTS_VOICE || "shimmer").toLowerCase();
const DEFAULT_OPENAI_VIBE = process.env.OPENAI_TTS_VIBE ||
`Affect: You are a warm, professional Indian recruiter. You genuinely care about the person you are speaking with.

Voice: Warm, clear, natural Indian voice. Medium pitch. Pleasant and easy to listen to.

Tone: Friendly and professional. Real and human — not corporate or scripted.

Pacing: Unhurried Indian conversational pace — warmer and slower than American English. Natural breath pauses between clauses.

Pronunciation: Speak with an Indian English accent throughout. Sentences end with a gentle upward melody — the characteristic Indian English intonation. The 't' and 'd' sounds are fuller and warmer (retroflex). The 'r' is a light clean tap. Vowels are open and clear.

Emotion: Brief soft laugh when something is genuinely good. Quiet "hmm" when thinking. Natural warmth in every sentence — smile through the voice.`;
const SOURCE_SAMPLE_RATE = 24000;
const SUPPORTED_OPENAI_VOICES = [
    "alloy",
    "ash",
    "ballad",
    "cedar",
    "coral",
    "echo",
    "fable",
    "marin",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
];
const MIN_OPENAI_SPEED = 0.25;
const MAX_OPENAI_SPEED = 4.0;

/**
 * µ-law encode a single sample from normalized float [-1, 1]
 * (G.711-style)..
 */
function encodeMulawSampleFromFloat(s) {
    const MU = 255;

    // Clamp to [-1, 1]
    s = Math.max(-1, Math.min(1, s));

    const sign = s < 0 ? 0x80 : 0;
    const mag = Math.log1p(MU * Math.abs(s)) / Math.log1p(MU);
    const code = (mag * 127) | 0;

    // Standard G.711 µ-law: bitwise complement
    return (~(sign | code)) & 0xff;
}

/**
 * Downsample 24 kHz PCM16 → 8 kHz PCM16 (simple 3:1 with averaging).
 * Input: Buffer of 16-bit LE samples at 24 kHz
 * Output: Buffer of 16-bit LE samples at 8 kHz
 */
function downsample24kTo8k(pcm24kBuffer) {
    if (!Buffer.isBuffer(pcm24kBuffer)) {
        throw new Error("[openaiTTS] downsample24kTo8k: input is not a Buffer");
    }

    const sampleCount = Math.floor(pcm24kBuffer.length / 2);
    const inputView = new Int16Array(
        pcm24kBuffer.buffer,
        pcm24kBuffer.byteOffset,
        sampleCount
    );

    // 24k → 8k = 3:1 (round up to avoid buffer underruns when sample count isn't divisible by 3)
    const outSamples = Math.ceil(sampleCount / 3);
    const outBuffer = Buffer.alloc(outSamples * 2); // 16-bit LE

    let outIndex = 0;
    for (let i = 0; i < sampleCount; i += 3) {
        const s0 = inputView[i];
        const s1 = inputView[i + 1] ?? s0;
        const s2 = inputView[i + 2] ?? s1;
        const avg = Math.round((s0 + s1 + s2) / 3);

        outBuffer.writeInt16LE(avg, outIndex * 2);
        outIndex++;
    }

    return outBuffer;
}

/**
 * Convert 16-bit little-endian PCM @ 8kHz → G.711 µ-law bytes.
 */
function pcm16ToMulaw(pcm16Buffer8k) {
    if (!Buffer.isBuffer(pcm16Buffer8k)) {
        throw new Error("[openaiTTS] pcm16ToMulaw: input is not a Buffer");
    }

    const sampleCount = Math.floor(pcm16Buffer8k.length / 2);
    const mulawBuffer = Buffer.alloc(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
        const sample = pcm16Buffer8k.readInt16LE(i * 2); // -32768..32767
        const floatSample = sample / 32768; // normalize to [-1, 1]
        mulawBuffer[i] = encodeMulawSampleFromFloat(floatSample);
    }

    return mulawBuffer;
}

function normalizeEncoding(encoding) {
    return (encoding || "MULAW").toString().trim().toUpperCase();
}

function normalizeSampleRate(sampleRate, forceMulaw) {
    const requested = Number(sampleRate) || 8000;
    if (forceMulaw && requested !== 8000) {
        console.log(
            `[openaiTTS] µ-law output requires 8000Hz; overriding requested ${requested}`
        );
    }
    return forceMulaw ? 8000 : requested;
}

function normalizeOpenAiSpeed(rate) {
    const parsed = Number(rate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return undefined;
    }
    const clamped = Math.max(MIN_OPENAI_SPEED, Math.min(MAX_OPENAI_SPEED, parsed));
    return Math.abs(clamped - 1) < 0.01 ? undefined : Number(clamped.toFixed(2));
}

function buildInstructions(languageCode, vibe) {
    const parts = [];

    if (vibe) parts.push(vibe);

    if (languageCode && languageCode.startsWith('en-IN')) {
        parts.push(
            'ACCENT REINFORCEMENT: Speak with authentic Indian English accent throughout.' +
            ' Retroflex \'t\' and \'d\' consonants — fuller and rounder.' +
            ' Characteristic rising intonation at sentence ends — the Indian English melody.' +
            ' Open clear vowels. Light \'r\' tap.' +
            ' Unhurried Indian conversation pace.' +
            ' Warm, genuine — sound like a real person, not a system.'
        );
    } else if (languageCode) {
        parts.push(`Lean into the ${languageCode} accent naturally.`);
    }

    return parts.length ? parts.join('\n\n') : undefined;
}

function resolveOpenAiVoice(preferredVoice, ssmlGender) {
    const normalized = (preferredVoice || "").toLowerCase().trim();
    if (normalized) {
        for (const candidate of SUPPORTED_OPENAI_VOICES) {
            if (normalized === candidate || normalized.includes(candidate)) {
                return candidate;
            }
        }
    }
    if (ssmlGender?.toUpperCase() === "MALE") {
        return "verse";
    }
    // Default to coral for female/unspecified — best Indian female accent quality
    if (!ssmlGender || ssmlGender.toUpperCase() === "FEMALE") {
        return "coral";
    }
    return DEFAULT_OPENAI_VOICE;
}

function resamplePCM16(pcmBuffer, sourceSampleRate, targetSampleRate) {
    if (!Buffer.isBuffer(pcmBuffer)) {
        throw new Error("[openaiTTS] resamplePCM16: input is not a Buffer");
    }
    if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0) {
        throw new Error("[openaiTTS] resamplePCM16: invalid target sample rate");
    }
    if (targetSampleRate === sourceSampleRate) {
        return Buffer.from(pcmBuffer);
    }

    const sampleCount = Math.floor(pcmBuffer.length / 2);
    const inputView = new Int16Array(
        pcmBuffer.buffer,
        pcmBuffer.byteOffset,
        sampleCount
    );

    const ratio = targetSampleRate / sourceSampleRate;
    const outSamples = Math.max(1, Math.floor(sampleCount * ratio));
    const outBuffer = Buffer.alloc(outSamples * 2);

    for (let i = 0; i < outSamples; i++) {
        const srcIndex = i / ratio;
        const leftIndex = Math.min(Math.floor(srcIndex), sampleCount - 1);
        const rightIndex = Math.min(leftIndex + 1, sampleCount - 1);
        const frac = srcIndex - leftIndex;

        const leftSample = inputView[leftIndex];
        const rightSample = inputView[rightIndex];
        const interpolated = leftSample + (rightSample - leftSample) * frac;

        outBuffer.writeInt16LE(Math.round(interpolated), i * 2);
    }

    return outBuffer;
}

function convertSampleRate(pcm24kBuffer, targetSampleRate) {
    if (targetSampleRate === SOURCE_SAMPLE_RATE) {
        return Buffer.from(pcm24kBuffer);
    }
    if (targetSampleRate === 8000) {
        return downsample24kTo8k(pcm24kBuffer);
    }
    return resamplePCM16(pcm24kBuffer, SOURCE_SAMPLE_RATE, targetSampleRate);
}

/**
 * OpenAI TTS → raw audio for telephony pipeline
 *
 * encoding:
 *   - "MULAW"    → return G.711 µ-law @ 8kHz
 *   - "LINEAR16" → return PCM16 LE @ 8kHz
 */

export async function openaiTTS({
    text = "AI Call testing audio",
    languageCode = "en-IN",
    ssmlGender = "FEMALE",
    voiceName,
    audioEncoding = "MULAW",
    sampleRateHertz = 8000,
    speakingRate = 1.0,
    vibe = DEFAULT_OPENAI_VIBE,
} = {}) {
    const enc = normalizeEncoding(audioEncoding);
    const wantMulaw = enc === "MULAW";
    const targetSampleRate = normalizeSampleRate(sampleRateHertz, wantMulaw);
    const voice = resolveOpenAiVoice(voiceName, ssmlGender);
    const instructions = buildInstructions(languageCode, vibe);
    const speed = normalizeOpenAiSpeed(speakingRate);

    // console.log(
    //     `[openaiTTS] Generating TTS for: "${text}" | targetEncoding=${enc}` +
    //     ` | sampleRate=${targetSampleRate}Hz | voice=${voice} | vibe=${vibe}` +
    //     (speed ? ` | speed=${speed}` : "")
    // );
    const responseFormat = (enc === "MP3") ? "mp3" : "pcm";

    const requestPayload = {
        model: OPENAI_TTS_MODEL,
        voice,
        input: text,
        response_format: responseFormat,
    };

    if (instructions) {
        requestPayload.instructions = instructions;
    }
    if (speed) {
        requestPayload.speed = speed;
    }

    // 1) Ask OpenAI for raw PCM at 24 kHz
    const response = await client.audio.speech.create(requestPayload);
    const arrayBuffer = await response.arrayBuffer();
    const pcm24k = Buffer.from(arrayBuffer);

    if (!pcm24k.length) {
        throw new Error("[openaiTTS] Empty PCM buffer from OpenAI");
    }

    // console.log(
    //     `[openaiTTS] PCM ${SOURCE_SAMPLE_RATE}Hz received (${pcm24k.length} bytes)`
    // );

    // 2) Convert 24 kHz → requested sample rate (defaults to 8 kHz for telephony)
    const pcmTarget = convertSampleRate(pcm24k, targetSampleRate);
    // console.log(
    //     `[openaiTTS] Resampled to ${targetSampleRate}Hz (${pcmTarget.length} bytes)`
    // );

    // 3) Convert to requested final encoding
    if (wantMulaw) {
        const mulawBuffer = pcm16ToMulaw(pcmTarget);
        // console.log(
        //     `[openaiTTS] Converted to µ-law (${mulawBuffer.length} bytes)`
        // );

        console.log(
            `[openaiTTS] 1. Generated TTS for: "${text}" | targetEncoding=${enc}` +
            ` | sampleRate=${targetSampleRate}Hz | voice=${voice} | vibe=${vibe}` +
            (speed ? ` | speed=${speed}` : "")
        );
        return mulawBuffer;
    }

    // If someone explicitly wants LINEAR16 (or another PCM format), return PCM16

    console.log(
        `[openaiTTS] 2. Generated TTS for: "${text}" | targetEncoding=${enc}` +
        ` | sampleRate=${targetSampleRate}Hz | voice=${voice} | vibe=${vibe}` +
        (speed ? ` | speed=${speed}` : "")
    );
    return pcmTarget;
}

export async function universalTextToSpeech(
    text = 'AI Call testing audio',
    languageCode = 'en-IN',
    ssmlGender = 'FEMALE',
    voiceName = 'en-IN-Chirp-HD-F',
    audioEncoding = 'MULAW',
    sampleRateHertz = 8000,
    speakingRate = 1.0,
    vibe = DEFAULT_OPENAI_VIBE,
) {
    return await openaiTTS({
        text,
        languageCode,
        ssmlGender,
        voiceName,
        audioEncoding,
        sampleRateHertz,
        speakingRate,
        vibe,
    });
}

export default universalTextToSpeech;
