import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { universalTextToSpeech } from "./googleTTSAndSTTUtils.js";
// import { universalTextToSpeech } from "./elevenLabsTTSUtils.js";

const TOTAL_REQUESTS = Number(process.env.TTS_TEST_REQUEST_COUNT ?? 50);
const CSV_FILE_NAME = "googleTTSAndSTTUtilsTestResults.csv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.join(__dirname, CSV_FILE_NAME);

function now() {
    return Date.now();
}

function formatTimestamp(date = new Date()) {
    const pad = (num, size = 2) => String(num).padStart(size, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = pad(date.getMilliseconds(), 3);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function toCsvField(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/"/g, "\"\"")}"`;
    }
    return str;
}

async function runBatchTtsTest() {
    console.log(`[TTS Test] Launching ${TOTAL_REQUESTS} concurrent universalTextToSpeech requests...`);
    const batchStart = now();

    const requests = Array.from({ length: TOTAL_REQUESTS }, (_, idx) => {
        const sampleText = `Hirex REC load test #${idx + 1} @ ${new Date().toISOString()}`;
        const requestStart = now();
        const startTimestamp = formatTimestamp();
        console.log(`[TTS Test] ↗ Request ${idx + 1} started at ${startTimestamp}`);
        return universalTextToSpeech(sampleText)
            .then(buffer => ({
                idx,
                durationMs: now() - requestStart,
                byteLength: buffer?.length ?? 0,
                startTimestamp,
                endTimestamp: formatTimestamp(),
                status: "success",
            }))
            .catch(err => {
                const failureInfo = {
                    idx,
                    durationMs: now() - requestStart,
                    byteLength: 0,
                    startTimestamp,
                    endTimestamp: formatTimestamp(),
                    status: "failure",
                    errorMessage: err?.message || String(err),
                };
                throw failureInfo;
            });
    });

    const settledResults = await Promise.allSettled(requests);

    let successCount = 0;
    let failureCount = 0;
    const csvRows = [];

    settledResults.forEach((result, idx) => {
        const requestNumber = idx + 1;
        if (result.status === "fulfilled") {
            successCount += 1;
            const { durationMs, byteLength, startTimestamp, endTimestamp } = result.value || {};
            console.log(`[TTS Test] ✔️ Request ${requestNumber} | Started ${startTimestamp} | Completed ${endTimestamp} | ${durationMs}ms | ${byteLength} bytes`);
            csvRows.push({
                requestNumber,
                startTimestamp,
                endTimestamp,
                durationMs,
                byteLength,
                status: "success",
                errorMessage: "",
            });
        } else {
            failureCount += 1;
            const failureInfo = result.reason || {};
            const { durationMs, byteLength, startTimestamp, endTimestamp, errorMessage } = failureInfo;
            console.error(`[TTS Test] ❌ Request ${requestNumber} failed | Started ${startTimestamp} | Completed ${endTimestamp} | ${durationMs}ms | Error: ${errorMessage || failureInfo}`);
            csvRows.push({
                requestNumber,
                startTimestamp: startTimestamp || "",
                endTimestamp: endTimestamp || "",
                durationMs: durationMs ?? "",
                byteLength: byteLength ?? "",
                status: "failure",
                errorMessage: errorMessage || JSON.stringify(failureInfo),
            });
        }
    });

    const elapsedMs = now() - batchStart;
    console.log(`[TTS Test] Completed in ${elapsedMs}ms | Success: ${successCount} | Failures: ${failureCount}`);

    const csvHeader = [
        "requestNumber",
        "startTimestamp",
        "endTimestamp",
        "durationMs",
        "byteLength",
        "status",
        "errorMessage",
    ].join(",");

    const csvBody = csvRows
        .sort((a, b) => {
            if (!a.startTimestamp && !b.startTimestamp) return 0;
            if (!a.startTimestamp) return 1;
            if (!b.startTimestamp) return -1;
            return a.startTimestamp.localeCompare(b.startTimestamp);
        })
        .map(row => [
            toCsvField(row.requestNumber),
            toCsvField(row.startTimestamp),
            toCsvField(row.endTimestamp),
            toCsvField(row.durationMs),
            toCsvField(row.byteLength),
            toCsvField(row.status),
            toCsvField(row.errorMessage),
        ].join(","))
        .join("\n");

    const csvOutput = `${csvHeader}\n${csvBody}`;
    fs.writeFileSync(CSV_FILE_PATH, csvOutput, "utf-8");
    console.log(`[TTS Test] Summary written to ${CSV_FILE_PATH}`);

    if (failureCount > 0) {
        console.error("[TTS Test] Some requests failed.");
        process.exitCode = 1;
    }
}

setTimeout(() => {
    runBatchTtsTest().catch(err => {
        console.error("[TTS Test] Unhandled error:", err);
        process.exit(1);
    });
}, 2_000);
