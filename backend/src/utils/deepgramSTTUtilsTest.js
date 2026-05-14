import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { transcribeAudioWithDeepgram } from "./deepgramSTTUtils.js";

const TOTAL_REQUESTS = Number(process.env.STT_TEST_REQUEST_COUNT ?? 50);
const AUDIO_FILE_PATH = process.env.STT_TEST_AUDIO_PATH || "./sample.webm";
const CSV_FILE_NAME = "deepgramSTTUtilsTestResults.csv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.join(__dirname, CSV_FILE_NAME);

function now() {
    return Date.now();
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

function loadAudioAsDataUri() {
    const buffer = fs.readFileSync(AUDIO_FILE_PATH);
    const base64 = buffer.toString("base64");
    return `data:audio/webm;base64,${base64}`;
}

async function runBatchSttTest() {
    console.log(`[STT Test][DG] Launching ${TOTAL_REQUESTS} concurrent transcribeAudioWithDeepgram requests`);
    const batchStart = now();

    const audioDataUri = loadAudioAsDataUri();
    const requests = Array.from({ length: TOTAL_REQUESTS }, (_, idx) => {
        const requestStart = now();
        const startTimestamp = formatTimestamp();

        console.log(`[STT Test][DG] ↗ Request ${idx + 1} started at ${startTimestamp}`);

        return transcribeAudioWithDeepgram(audioDataUri)
            .then(text => ({
                idx,
                durationMs: now() - requestStart,
                transcriptLength: text?.length ?? 0,
                startTimestamp,
                endTimestamp: formatTimestamp(),
                status: "success",
            }))
            .catch(err => {
                throw {
                    idx,
                    durationMs: now() - requestStart,
                    transcriptLength: 0,
                    startTimestamp,
                    endTimestamp: formatTimestamp(),
                    status: "failure",
                    errorMessage: err?.message || String(err),
                };
            });
    });

    const settledResults = await Promise.allSettled(requests);

    let successCount = 0;
    let failureCount = 0;
    const csvRows = [];

    settledResults.forEach((result, idx) => {
        const requestNumber = idx + 1;

        if (result.status === "fulfilled") {
            successCount++;
            const r = result.value;
            console.log(
                `[STT Test][DG] ✔ Request ${requestNumber} | ${r.durationMs}ms | transcript=${r.transcriptLength}`
            );

            csvRows.push({
                requestNumber,
                startTimestamp: r.startTimestamp,
                endTimestamp: r.endTimestamp,
                durationMs: r.durationMs,
                transcriptLength: r.transcriptLength,
                status: "success",
                errorMessage: "",
            });
        } else {
            failureCount++;
            const r = result.reason || {};
            console.error(
                `[STT Test][DG] ❌ Request ${requestNumber} failed | ${r.durationMs}ms | ${r.errorMessage}`
            );

            csvRows.push({
                requestNumber,
                startTimestamp: r.startTimestamp || "",
                endTimestamp: r.endTimestamp || "",
                durationMs: r.durationMs ?? "",
                transcriptLength: r.transcriptLength ?? "",
                status: "failure",
                errorMessage: r.errorMessage || JSON.stringify(r),
            });
        }
    });

    const elapsedMs = now() - batchStart;
    console.log(
        `[STT Test][DG] Completed in ${elapsedMs}ms | Success=${successCount} | Failures=${failureCount}`
    );

    const csvHeader = [
        "requestNumber",
        "startTimestamp",
        "endTimestamp",
        "durationMs",
        "transcriptLength",
        "status",
        "errorMessage",
    ].join(",");

    const csvBody = csvRows
        .sort((a, b) => a.startTimestamp.localeCompare(b.startTimestamp))
        .map(row => [
            toCsvField(row.requestNumber),
            toCsvField(row.startTimestamp),
            toCsvField(row.endTimestamp),
            toCsvField(row.durationMs),
            toCsvField(row.transcriptLength),
            toCsvField(row.status),
            toCsvField(row.errorMessage),
        ].join(","))
        .join("\n");

    fs.writeFileSync(CSV_FILE_PATH, `${csvHeader}\n${csvBody}`, "utf-8");
    console.log(`[STT Test][DG] CSV written to ${CSV_FILE_PATH}`);

    if (failureCount > 0) {
        process.exitCode = 1;
    }
}

setTimeout(() => {
    runBatchSttTest().catch(err => {
        console.error("[STT Test][DG] Unhandled error:", err);
        process.exit(1);
    });
}, 2000);
