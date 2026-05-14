import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import { tmpMediaDir, ttsMediaTempDir } from "../../server.js";
import fs from "fs";
import path from "path";
import { getDownloadURL, uploadBufferToFirebase } from "./firebaseUtils.js";
import { sanitizeFileName /*, writeWavHeader*/ } from "./fileIOUtils.js";
import { SpeechClient } from "@google-cloud/speech";

// import "./googleTTSAndSTTUtilsTest.js";

const speechClient = new SpeechClient();

const DEFAULT_TTS_CLIENT_POOL_SIZE = 10;
const resolvedPoolSize =
    parseInt(process.env?.GOOGLE_TTS_CLIENT_POOL_SIZE ?? process.env?.TTS_CLIENT_POOL_SIZE ?? "", 10);
const ttsClientPoolSize = Number.isFinite(resolvedPoolSize) && resolvedPoolSize > 0
    ? resolvedPoolSize
    : DEFAULT_TTS_CLIENT_POOL_SIZE;
const ttsClientPool = Array.from({ length: ttsClientPoolSize }, () => new TextToSpeechClient());
let ttsClientIndex = 0;
function getTtsClient() {
    const client = ttsClientPool[ttsClientIndex];
    ttsClientIndex = (ttsClientIndex + 1) % ttsClientPool.length;
    return client;
}

// Enable disk cache only for these NODE_ENV values

const envArr = [
    // "local",
    // "production",
    // "development",
];

function now() { return Date.now(); }
function durMs(t0) { return `${(Date.now() - t0).toFixed(0)}ms`; }

// Ensure cache directory exists when caching is enabled
function ensureDirSafe(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    } catch (e) {
        console.log("⚠️ [FS] Failed to ensure dir:", dirPath, "|", e?.message || e);
        return false;
    }
}

// ------------------- TTS UTILITIES -------------------

export function addSilencePadding(buffer, sampleRate = 8000, durationMs = 100) {
    const bytesPerSample = 1;
    const numSilentSamples = Math.floor(sampleRate * (durationMs / 1000));
    const silence = Buffer.alloc(numSilentSamples * bytesPerSample, 0xff);
    return Buffer.concat([silence, buffer, silence]);
}


/**
 * If Google TTS (or anything upstream) returns μ-law inside a WAV container,
 * strip the RIFF/WAVE/fact/etc chunks and return only the raw μ-law data.
 */
export function ensureRawMulaw(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 64) return buffer;

    const riff = buffer.slice(0, 4).toString('ascii');
    const wave = buffer.slice(8, 12).toString('ascii');

    if (riff !== 'RIFF' || wave !== 'WAVE') {
        return buffer;
    }

    try {
        // Walk chunks: starting after "RIFFxxxxWAVE" (12 bytes)
        let offset = 12;
        while (offset + 8 <= buffer.length) {
            const chunkId = buffer.slice(offset, offset + 4).toString('ascii');
            const chunkSize = buffer.readUInt32LE(offset + 4);
            offset += 8;

            if (chunkId === 'data') {
                // Return just the data portion
                if (offset + chunkSize > buffer.length) {
                    // If size is weird, at least drop the headers and return the rest
                    return buffer.slice(offset);
                }
                return buffer.slice(offset, offset + chunkSize);
            }

            offset += chunkSize;
        }
    } catch (err) {
        console.log('[TextToSpeech] Failed to strip WAV header, using original buffer:', err);
    }

    // If anything goes wrong, fall back to original buffer
    return buffer;
}



/**
 * Universal Text-to-Speech controller.
 * Converts input text to speech audio using Google Cloud TTS.
 *
 * @param {string} text
 * @param {string} languageCode
 * @param {'FEMALE'|'MALE'|'NEUTRAL'} ssmlGender
 * @param {string} voiceName
 * @param {'MP3'|'LINEAR16'|'OGG_OPUS'|'MULAW'} audioEncoding
 * @param {number} sampleRateHertz
 * @param {number} speakingRate Default is 1.0 for Slow = 0.75, Slightly Slow = 0.85, Normal = 1.0, Fast = 1.25 :: Minimum: 0.25 (4 times slower than normal); Maximum: 4.0 (4 times faster than normal); Default (normal speed): 1.0
 * @returns {Promise<Buffer>}
 */
export async function universalTextToSpeech(
    text = 'AI Call testing audio',
    languageCode = 'en-IN',
    ssmlGender = 'FEMALE',
    voiceName = 'en-IN-Chirp-HD-F',
    audioEncoding = 'MULAW',
    sampleRateHertz = 8000,
    speakingRate = 1.0,
) {
    const cacheFileName = sanitizeFileName(`${languageCode} ${ssmlGender} ${voiceName} ${audioEncoding} ${sampleRateHertz} ${speakingRate} ${text.replaceAll(" ", "")}.raw`);
    const cacheFilePath = path.join(ttsMediaTempDir, cacheFileName);

    if (envArr.includes(process?.env?.NODE_ENV)) {
        try {
            const fls = fs.readdirSync(ttsMediaTempDir) || [];
            const cacheFileExists = fls.includes(cacheFileName);
            if (cacheFileExists) {
                return fs.readFileSync(cacheFilePath);
            }

        } catch (err) {
            console.log(
                "\n [TextToSpeech] ❌ Error in getting tts cache file: ", err, "\n"
            );
        }

    }

    try {
        if (!text || typeof text !== 'string') {
            console.warn('[TextToSpeech] No text provided in request.');
        }

        // Build the TTS request
        const request = {
            input: { text },
            voice: {
                languageCode,
                name: voiceName,
                ssmlGender: protos.google.cloud.texttospeech.v1.SsmlVoiceGender[ssmlGender],
            },
            audioConfig: {
                audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding[audioEncoding],
                sampleRateHertz,
                speakingRate,
            },
            advancedVoiceOptions: {
                lowLatencyJourneySynthesis: false
            }
        };

        // Call Google Cloud TTS
        const client = getTtsClient();
        const [response] = await client.synthesizeSpeech(request);

        if (response.audioContent) {
            let audioBuffer;
            if (typeof response.audioContent === 'string') {
                audioBuffer = Buffer.from(response.audioContent, 'base64');

            } else if (response.audioContent instanceof Uint8Array) {
                audioBuffer = Buffer.from(response.audioContent);

            } else {
                const errMsg = '[TextToSpeech] Unknown audioContent type: ' + typeof response.audioContent
                console.log(errMsg);
                throw new Error(errMsg);
            }

            // *** IMPORTANT FIX ***
            // If the audio is actually a μ-law WAV, strip the RIFF/WAVE header & chunks.
            audioBuffer = ensureRawMulaw(audioBuffer);

            // Log response info (audio length in bytes)
            // console.log(`[TextToSpeech] Audio generated: ${audioBuffer.length} bytes for "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`);

            // Add μ-law silence padding at start & end
            // audioBuffer = addSilencePadding(audioBuffer, sampleRateHertz);

            if (audioBuffer && audioBuffer?.length > 0 && cacheFileName?.length <= 255 && envArr.includes(process?.env?.NODE_ENV)) {
                (async () => {
                    try {
                        fs.writeFileSync(cacheFilePath, audioBuffer);
                    } catch (err) {
                        console.log(
                            "\n [TextToSpeech] ❌ Error in creating tts cache file: ", err, "\n"
                        );

                    }
                })();
            }

            return audioBuffer;
        } else {
            const errMsg = '[TextToSpeech] No audio generated for text.';
            console.warn(errMsg);
            throw new Error(errMsg);
        }
    } catch (err) {
        console.log('[TextToSpeech] Error generating speech audio:', err);
        throw new Error(err);

    }
}



// ------------------- GOOGLE STT -------------------
export async function transcribeAudio(audioData) {
    const t0 = Date.now();
    console.log("\n🎧 [STT] ============== transcribeAudio() START ==============");

    try {
        if (!audioData) throw new Error("No audio data received.");
        console.log("🔎 [STT] Raw prefix:", audioData.slice(0, 64));

        // ✅ Robust strip: remove everything up to and including "base64,"
        const base64Marker = "base64,";
        const idx = audioData.indexOf(base64Marker);
        if (idx === -1) {
            throw new Error("Invalid data URI: missing base64 marker");
        }
        // Old (too strict): /^data:audio\/[^;]+;base64,/
        // Better:
        const base64Data = (audioData || "").replace(/^data:audio\/[^,]+;base64,/, "");


        const audioBuffer = Buffer.from(base64Data, "base64");
        console.log("📦 [STT] Audio buffer bytes:", audioBuffer.length);

        if (audioBuffer.length < 1500) {
            console.warn("⚠️ [STT] Buffer too small; likely silence or bad payload.");
            return "";
        }

        // Pick encoding by container (leave as-is if you're only using WebM)
        const isWebM = audioData.startsWith("data:audio/webm");
        const isOgg = audioData.startsWith("data:audio/ogg");
        const encoding = isOgg ? "OGG_OPUS" : "WEBM_OPUS";
        const sampleRateHertz = 48000;

        console.log("⚙️ [STT] Encoding:", encoding, "| sampleRateHertz:", sampleRateHertz);
        const request = {
            audio: { content: audioBuffer.toString("base64") },
            config: {
                encoding,
                sampleRateHertz,
                languageCode: "en-IN",
                alternativeLanguageCodes: ["en-US"],
                enableAutomaticPunctuation: true,
                useEnhanced: true,
                // model: "latest_long",
            },
        };

        console.log("📡 [STT] Sending to Google Speech API...");
        const tCall = Date.now();
        const [response] = await speechClient.recognize(request);
        console.log("🕒 [STT] Google STT duration:", Date.now() - tCall, "ms");

        if (!response || !response.results?.length) {
            console.warn("⚠️ [STT] Empty result. Bytes:", audioBuffer.length);
            return "";
        }

        const transcription = response.results
            .map(r => r.alternatives?.[0]?.transcript || "")
            .join(" ")
            .trim();

        console.log("📝 [STT] Transcribed text:", transcription || "(empty)");
        console.log("✅ [STT] DONE in", Date.now() - t0, "ms");
        return transcription;
    } catch (err) {
        console.error("❌ [STT] Error:", err?.message || err);
        console.log("🏁 [STT] FAILED in", Date.now() - t0, "ms");
        return "";
    }
}


// ------------------- Optional Firebase Upload Test -------------------
// universalTextToSpeech("Test Firebase upload speech...").then(auBuf => {
//   const tmpFilePath = path.join(tmpMediaDir, "testing_code_file.wav");
//   fs.writeFileSync(tmpFilePath, auBuf);
//   uploadBufferToFirebase(auBuf, "aiCallAudios/testing_code_file.wav", "audio/wav")
//     .then(async () => {
//       const remoteUrl = await getDownloadURL("aiCallAudios/testing_code_file.wav");
//       console.log("🌐 [TTS] Uploaded to Firebase:", remoteUrl);
//     })
//     .catch(console.error);
// });



// // For API testing...
// setTimeout(() => {
//     universalTextToSpeech("Hey hi...").then((buf) => {
//         fs.writeFileSync("recordedTtsBufHeyHi.raw", buf);
//         console.log(
//             "Hey Hi... audioBuffer: \n\n", buf.toString("base64"), "\n\n"
//         );
//     })
//         .catch((err) => {
//             console.log("Error in creating Hey Hi... audioBuffer: ", err);
//         });

// }, 5000);

export default universalTextToSpeech;
