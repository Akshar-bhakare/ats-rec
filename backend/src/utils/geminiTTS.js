import { GoogleGenAI } from "@google/genai";

/* ============================================================
   1. µ-law + DSP utilities (telephony safe)
============================================================ */
function encodeMulawSampleFromFloat(s) {
    const MU = 255;
    s = Math.max(-1, Math.min(1, s));
    const sign = s < 0 ? 0x80 : 0;
    const mag = Math.log1p(MU * Math.abs(s)) / Math.log1p(MU);
    const code = (mag * 127) | 0;
    return (~(sign | code)) & 0xff;
}

function downsample24kTo8k(pcm24k) {
    const inputSamples = Math.floor(pcm24k.length / 2);
    const input = new Int16Array(
        pcm24k.buffer,
        pcm24k.byteOffset,
        inputSamples
    );

    const outSamples = Math.floor(inputSamples / 3);
    const out = Buffer.allocUnsafe(outSamples * 2);

    let outIndex = 0;

    for (let i = 0; i + 2 < inputSamples && outIndex < outSamples; i += 3) {
        const s0 = input[i];
        const s1 = input[i + 1];
        const s2 = input[i + 2];
        const avg = (s0 + s1 + s2) / 3;

        out.writeInt16LE(avg | 0, outIndex * 2);
        outIndex++;
    }

    return out;
}

function pcm16ToMulaw(pcm8k) {
    const samples = pcm8k.length / 2;
    const out = Buffer.alloc(samples);

    for (let i = 0; i < samples; i++) {
        const s = pcm8k.readInt16LE(i * 2);
        out[i] = encodeMulawSampleFromFloat(s / 32768);
    }
    return out;
}

/* ============================================================
   2. Gemini Preview TTS (AUDIO modality)
============================================================ */
async function geminiTTS(text, encoding = "MULAW") {
    console.log(`[GeminiTTS] Generating TTS: "${text}"`);

    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [
            {
                role: "user",
                parts: [{ text }],
            },
        ],
        config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: "Kore",
                    },
                },
            },
        },
    });

    const base64Audio =
        response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
        throw new Error("[GeminiTTS] No audio returned");
    }

    // Gemini returns 24kHz PCM16
    const pcm24k = Buffer.from(base64Audio, "base64");

    // Downsample → 8kHz
    const pcm8k = downsample24kTo8k(pcm24k);

    if (encoding === "MULAW") {
        return pcm16ToMulaw(pcm8k);
    }

    return pcm8k; // LINEAR16 @ 8kHz
}

/* ============================================================
   3. Universal wrapper (OpenAI-compatible signature)
============================================================ */
async function universalTextToSpeech(
    text = "AI Call testing audio",
    languageCode = "en-IN",     // kept for compatibility
    ssmlGender = "FEMALE",      // kept for compatibility
    voiceName = "en-IN-female", // ignored by Gemini preview
    audioEncoding = "MULAW",
    sampleRateHertz = 8000,
    speakingRate = 1.0,
    req = null
) {
    return geminiTTS(text, audioEncoding);
}

/* ============================================================
   4. Exports (ESM-safe)
============================================================ */
export { universalTextToSpeech };
export default universalTextToSpeech;
