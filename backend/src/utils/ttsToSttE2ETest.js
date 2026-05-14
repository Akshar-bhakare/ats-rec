import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { universalTextToSpeech } from "./googleTTSAndSTTUtils.js";
import { transcribeAudioWithDeepgram } from "./deepgramSTTUtils.js";

const TOTAL_REQUESTS = Number(process.env.TTS_STT_TEST_REQUEST_COUNT ?? 5);
const CSV_FILE_NAME = "ttsToSttE2ETestResults.csv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.join(__dirname, CSV_FILE_NAME);

/* ---------------- utils ---------------- */
function now() {
    return Date.now();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTimestamp(date = new Date()) {
    const pad = (n, s = 2) => String(n).padStart(s, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function toCsvField(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    return str.includes(",") || str.includes("\"") || str.includes("\n")
        ? `"${str.replace(/"/g, "\"\"")}"`
        : str;
}

function pcm16ToWav(buffer, sampleRate = 16000, channels = 1) {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * channels * 2;
    const blockAlign = channels * 2;

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + buffer.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(buffer.length, 40);

    return Buffer.concat([header, buffer]);
}

/* ---------------- main ---------------- */
async function runBatchTtsToSttTest() {
    console.log(`[E2E][TTS→STT] Running ${TOTAL_REQUESTS} requests (1 sec interval)`);

    const batchStart = now();
    const results = [];

    for (let idx = 0; idx < TOTAL_REQUESTS; idx++) {
        const text = `Hirex REC E2E test #${idx + 1} @ ${new Date().toISOString()}`;
        const startTimestamp = formatTimestamp();
        const requestStart = now();

        console.log(`[E2E] ↗ Request ${idx + 1} started`);

        try {
            /* ---- TTS ---- */
            const ttsStart = now();
            const audioBuffer = await universalTextToSpeech(text);

            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error("TTS returned empty audio buffer");
            }

            const ttsDurationMs = now() - ttsStart;

            /* ---- STT ---- */
            const sttStart = now();
            const wavBuffer = pcm16ToWav(audioBuffer);
            const audioDataUri = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;

            const transcriptRaw = await transcribeAudioWithDeepgram(audioDataUri);
            const transcript = (transcriptRaw || "").trim();
            const sttDurationMs = now() - sttStart;

            results.push({
                requestNumber: idx + 1,
                startTimestamp,
                endTimestamp: formatTimestamp(),
                totalDurationMs: now() - requestStart,
                ttsDurationMs,
                sttDurationMs,
                audioBytes: audioBuffer.length,
                transcriptLength: transcript.length,
                transcriptEmpty: transcript.length === 0,
                status: "success",
                errorMessage: "",
            });

            console.log(
                `[E2E] ✔ Request ${idx + 1} | TTS=${ttsDurationMs}ms | STT=${sttDurationMs}ms | empty=${transcript.length === 0}`
            );
        } catch (err) {
            results.push({
                requestNumber: idx + 1,
                startTimestamp,
                endTimestamp: formatTimestamp(),
                totalDurationMs: now() - requestStart,
                ttsDurationMs: "",
                sttDurationMs: "",
                audioBytes: "",
                transcriptLength: "",
                transcriptEmpty: "",
                status: "failure",
                errorMessage: err?.message || String(err),
            });

            console.error(
                `[E2E] ❌ Request ${idx + 1} failed | ${err?.message || err}`
            );
        }

        // ⏱️ 1 SECOND GAP BETWEEN REQUESTS
        if (idx < TOTAL_REQUESTS - 1) {
            await sleep(1000);
        }
    }

    const elapsedMs = now() - batchStart;
    console.log(`[E2E] Completed in ${elapsedMs}ms`);

    /* ---- CSV ---- */
    const csvHeader = [
        "requestNumber",
        "startTimestamp",
        "endTimestamp",
        "totalDurationMs",
        "ttsDurationMs",
        "sttDurationMs",
        "audioBytes",
        "transcriptLength",
        "transcriptEmpty",
        "status",
        "errorMessage",
    ].join(",");

    const csvBody = results
        .map(r => [
            toCsvField(r.requestNumber),
            toCsvField(r.startTimestamp),
            toCsvField(r.endTimestamp),
            toCsvField(r.totalDurationMs),
            toCsvField(r.ttsDurationMs),
            toCsvField(r.sttDurationMs),
            toCsvField(r.audioBytes),
            toCsvField(r.transcriptLength),
            toCsvField(r.transcriptEmpty),
            toCsvField(r.status),
            toCsvField(r.errorMessage),
        ].join(","))
        .join("\n");

    fs.writeFileSync(CSV_FILE_PATH, `${csvHeader}\n${csvBody}`, "utf-8");
    console.log(`[E2E] CSV written to ${CSV_FILE_PATH}`);
}

/* ---------------- bootstrap ---------------- */
setTimeout(() => {
    runBatchTtsToSttTest().catch(err => {
        console.error("[E2E] Unhandled error:", err);
        process.exit(1);
    });
}, 2000);
