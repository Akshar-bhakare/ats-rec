import { uploadBuffer, listFiles, getDownloadURL, deleteFilesByPrefix } from "../../utils/storageAdapter.js";

import fs from "fs";
import { spawn } from "child_process";
import { ffmpegPath, ffprobePath } from "../../utils/ffmpegConfig.js";
const path = (await import("path")).default;
const os = (await import("os")).default;

const fieldValue = (v) => {
    if (v == null) return v;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v && "value" in v) return v.value; // multipart field obj
    return String(v);
};

/**
 * Helper: Check if a file is a valid standalone WebM file using ffprobe.
 * Returns true if the file has a valid EBML/WebM header, false otherwise.
 */
async function isValidWebM(filePath) {
    const { spawn } = await import("child_process");
    return new Promise((resolve) => {
        const ffprobe = spawn("ffprobe", [
            "-hide_banner",
            "-loglevel", "error",
            filePath
        ]);

        let stderr = "";
        ffprobe.stderr.on("data", (d) => { stderr += d.toString(); });

        ffprobe.on("close", (code) => {
            // code 0 = valid WebM, non-zero = invalid/headerless
            const isValid = code === 0;
            if (!isValid) {
                console.log(`[WEBM-CHECK] ${path.basename(filePath)}: Invalid/headerless (ffprobe exit code ${code})`);
            } else {
                console.log(`[WEBM-CHECK] ${path.basename(filePath)}: Valid standalone WebM`);
            }
            resolve(isValid);
        });

        ffprobe.on("error", () => resolve(false));
    });
}

/**
 * Helper: Binary concatenate multiple files into a single output file.
 * Reads each input file and appends to the output in order.
 */
function mergeFilesBinary(inputPaths, outputPath) {
    console.log(`[BINARY-MERGE] Merging ${inputPaths.length} files into ${path.basename(outputPath)}`);

    // Write first file, then append others
    fs.writeFileSync(outputPath, fs.readFileSync(inputPaths[0]));

    for (let i = 1; i < inputPaths.length; i++) {
        fs.appendFileSync(outputPath, fs.readFileSync(inputPaths[i]));
    }

    console.log(`[BINARY-MERGE] Complete: ${path.basename(outputPath)} (${fs.statSync(outputPath).size} bytes)`);
}



/**
 * Helper: Download a Firebase Storage file with automatic retry on transient
 * network errors (ECONNRESET, ENOTFOUND, socket hang-up, etc.).
 * Retries up to maxRetries times with linear back-off (attempt * 2 seconds).
 */
async function downloadWithRetry(file, destination, maxRetries = 3, label = '') {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await file.download({ destination });
            return; // success
        } catch (err) {
            const isTransient = [
                'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'
            ].includes(err.code) || String(err.message).toLowerCase().includes('econnreset');

            if (attempt < maxRetries && isTransient) {
                const waitMs = attempt * 2000;
                console.warn(`[DOWNLOAD-RETRY] ${label} attempt ${attempt}/${maxRetries} failed (${err.code || err.message}), retrying in ${waitMs}ms...`);
                await new Promise(r => setTimeout(r, waitMs));
            } else {
                // Non-transient error or out of retries — rethrow
                console.error(`[DOWNLOAD-RETRY] ${label} failed permanently after ${attempt} attempt(s):`, err.message);
                throw err;
            }
        }
    }
}

/**
 * Recording Routes for chunked video upload and on-demand stitching.
 */
async function recordingRoutes(fastify, options) {
    // Ensure all requests are authenticated (populates req.user, req.client, req.conn)
    fastify.addHook('preHandler', fastify.authenticate);

    /**
     * GET /time
     * Returns the current server time in milliseconds.
     * Used for synchronizing recording start times.
     */
    fastify.get("/time", async (request, reply) => {
        return { time: Date.now() };
    });

    /**
     * POST /chunk
     * Receives a WebM chunk from the frontend and uploads it to Firebase Storage.
     * Also updates recording start times if provided.
     */
    fastify.post("/chunk", async (request, reply) => {
        try {
            let file = null;

            console.log("[RECORDING] Starting chunk processing...");
            if (request.body) {
                console.log(`[RECORDING] Body Keys: ${Object.keys(request.body).join(", ")}`);
                if (request.body.trackStartMs) {
                    console.log(`[RECORDING] request.body.trackStartMs: ${request.body.trackStartMs} (${typeof request.body.trackStartMs})`);
                } else {
                    console.log(`[RECORDING] request.body.trackStartMs is MISSING`);
                }
            } else {
                console.log("[RECORDING] request.body is MISSING");
            }

            // -------- 1) Extract file safely --------
            let fileBody = null;
            let rest = {};

            if (request.body) {
                const body = request.body;
                fileBody = body.file;
                // IMPORTANT: do NOT keep original objects; only copy references we need
                const { file, ..._rest } = body;
                rest = _rest;
            }

            if (fileBody) {
                const filePart = Array.isArray(fileBody) ? fileBody[0] : fileBody;

                if (filePart && typeof filePart.toBuffer === "function") {
                    const buffer = await filePart.toBuffer();
                    file = { buffer, filename: filePart.filename, mimetype: filePart.mimetype };
                } else if (filePart?.data && Buffer.isBuffer(filePart.data)) {
                    file = { buffer: filePart.data, filename: filePart.filename, mimetype: filePart.mimetype };
                } else if (filePart?.filepath || filePart?.path) {
                    const filePath = filePart.filepath || filePart.path;
                    const buffer = fs.readFileSync(filePath);
                    file = { buffer, filename: filePart.filename, mimetype: filePart.mimetype };
                    try { fs.unlinkSync(filePath); } catch (e) { }
                } else {
                    console.log("[RECORDING] Unknown file object structure:", filePart ? Object.keys(filePart) : "null");
                }
            }

            // -------- 2) Normalize ALL fields to primitives --------
            const cleanFields = {
                interviewScheduleId: fieldValue(rest.interviewScheduleId),
                candidateId: fieldValue(rest.candidateId),
                jobId: fieldValue(rest.jobId),
                trackType: fieldValue(rest.trackType),
                seqNo: fieldValue(rest.seqNo),
                mimeType: fieldValue(rest.mimeType),
            };

            // seqNo normalize to number
            let seqNo = cleanFields.seqNo;
            if (typeof seqNo === "string") seqNo = parseInt(seqNo, 10);

            const interviewScheduleId = cleanFields.interviewScheduleId;
            const trackType = cleanFields.trackType;
            const mimeType = cleanFields.mimeType;

            // console.log("[RECORDING] All parts processed.");
            // console.log("[RECORDING] Collected fields (clean):", {
            //   ...cleanFields,
            //   seqNo,
            // });
            console.log(
                `[RECORDING] File status: ${file ? `Present (${file.buffer?.length ?? 0} bytes)` : "Missing"} | Type: ${trackType} | Seq: ${seqNo}`
            );

            // -------- 3) Validate --------
            if (
                !interviewScheduleId ||
                !trackType ||
                seqNo === undefined ||
                seqNo === null ||
                Number.isNaN(seqNo) ||
                !file?.buffer
            ) {
                return reply.code(400).send({
                    ok: false,
                    error: "Missing required fields: interviewScheduleId, trackType, seqNo, and file are required",
                });
            }



            // -------- 3b) Handle trackStartMs (if provided) --------
            // Extract value safely whether it's a string, number, or multipart object field
            const trackStartMsVal = fieldValue(rest.trackStartMs);
            const chunkStartMsVal = fieldValue(rest.chunkStartMs);
            const chunkEndMsVal = fieldValue(rest.chunkEndMs);

            if (trackStartMsVal || chunkStartMsVal !== undefined) {
                const startMs = Number(trackStartMsVal);
                const chunkStartMs = Number(chunkStartMsVal);
                const chunkEndMs = Number(chunkEndMsVal);

                if (request.conn) {
                    try {
                        const updateUpdate = {};

                        // 1. Update global track startMs if provided
                        if (trackStartMsVal && !Number.isNaN(startMs)) {
                            updateUpdate.$set = {};
                            if (trackType === 'candidate') {
                                updateUpdate.$set['recordingMetadata.candidateStartMs'] = startMs;
                            } else if (trackType.startsWith('interviewer_')) {
                                const interviewerId = trackType.split('_')[1];
                                if (interviewerId) {
                                    updateUpdate.$set[`recordingMetadata.interviewerStartTimes.${interviewerId}`] = startMs;
                                }
                            }
                        }

                        // 2. Append chunk timing to the timeline index if provided
                        if (chunkStartMsVal !== undefined && chunkEndMsVal !== undefined && !Number.isNaN(chunkStartMs) && !Number.isNaN(chunkEndMs)) {
                            updateUpdate.$push = {};
                            const timelineEntry = { seqNo, startMs: chunkStartMs, endMs: chunkEndMs };

                            if (trackType === 'candidate') {
                                updateUpdate.$push['recordingMetadata.candidateTimeline'] = timelineEntry;
                            } else if (trackType.startsWith('interviewer_')) {
                                const interviewerId = trackType.split('_')[1];
                                if (interviewerId) {
                                    updateUpdate.$push[`recordingMetadata.interviewerTimelines.${interviewerId}`] = timelineEntry;
                                }
                            }
                        }

                        if (Object.keys(updateUpdate).length > 0) {
                            const result = await request.conn.models["InterviewSchedule"].updateOne(
                                { _id: interviewScheduleId },
                                updateUpdate
                            );
                            console.log(`[RECORDING-AUTH] Updated metadata for ${trackType} (startMs: ${startMs}, chunk: ${seqNo}) match: ${result.matchedCount}, mod: ${result.modifiedCount}`);
                        }
                    } catch (dbErr) {
                        console.error(`[RECORDING-AUTH] Failed to update recording metadata:`, dbErr);
                        // Don't fail the upload just because DB update failed
                    }
                } else {
                    console.warn(`[RECORDING-AUTH] Invalid startMs or no DB conn. conn: ${!!request.conn}`);
                }
            }

            // -------- 4) Lookup clientKey (Using authenticated context) --------
            if (!request.conn) {
                console.error("[RECORDING] No DB connection on request (auth failed?)");
                return reply.code(500).send({ ok: false, error: "Database connection unavailable" });
            }

            // Use req.client from authenticated session
            let clientKey = request.client ? request.client.toString() : "global";

            // Optional: Verify existence or fetch specific overrides if needed (omitted for speed)

            // -------- 5) Build remote path --------
            const paddedSeqNo = String(seqNo).padStart(6, "0");
            //const remotePath = `webrtcRecordings/${clientKey}/${interviewScheduleId}/segments/${trackType}/${paddedSeqNo}.webm`;
            const remotePath = `newRecordings/${clientKey}/${interviewScheduleId}/segments/${trackType}/${paddedSeqNo}.webm`;

            // -------- 6) Upload (pass ONLY primitives + buffer) --------
            await uploadBuffer(file.buffer, remotePath, mimeType || "video/webm");

            console.log(`[RECORDING] Uploaded chunk: ${remotePath} (${file.buffer.length} bytes)`);

            return reply.send({
                ok: true,
                trackType,
                seqNo,
                path: remotePath,
            });
        } catch (err) {
            console.error("[RECORDING] Chunk upload error:", err);
            return reply.code(500).send({
                ok: false,
                error: err.message || "Internal server error",
            });
        }
    });

    /**
     * GET /status
     * Returns the recording status for an interview.
     */
    fastify.get(
        "/status",
        async (request, reply) => {
            try {
                const { interviewScheduleId } = request.query;

                if (!interviewScheduleId) {
                    return reply.code(400).send({
                        ok: false,
                        error: "Missing interviewScheduleId query parameter"
                    });
                }

                if (!request.conn) {
                    return reply.code(500).send({ ok: false, error: "Database connection not available" });
                }

                const schedule = await request.conn.models["InterviewSchedule"]
                    .findById(interviewScheduleId)
                    .select("recordingStatus videoRecordingUrl")
                    .lean()
                    .exec();

                if (!schedule) {
                    return reply.code(404).send({
                        ok: false,
                        error: "Interview schedule not found"
                    });
                }

                return reply.send({
                    ok: true,
                    status: schedule.recordingStatus || "NOT_GENERATED",
                    url: schedule.videoRecordingUrl || null
                });
            } catch (err) {
                console.error("[RECORDING] Status check error:", err);
                return reply.code(500).send({
                    ok: false,
                    error: err.message || "Internal server error"
                });
            }
        }
    );

    /**
     * POST /cleanup
     * Deletes temporary WebM segment files for an interview (after final output is READY).
     */
    fastify.post("/cleanup", async (request, reply) => {
        try {
            const { interviewScheduleId } = request.body || {};

            if (!interviewScheduleId) {
                return reply.code(400).send({
                    ok: false,
                    error: "Missing interviewScheduleId in request body"
                });
            }

            if (!request.conn) {
                return reply.code(500).send({ ok: false, error: "Database connection not available" });
            }

            const schedule = await request.conn.models["InterviewSchedule"]
                .findById(interviewScheduleId)
                .select("recordingStatus videoRecordingUrl client")
                .lean()
                .exec();

            if (!schedule) {
                return reply.code(404).send({
                    ok: false,
                    error: "Interview schedule not found"
                });
            }

            if (schedule.recordingStatus !== "READY" || !schedule.videoRecordingUrl) {
                return reply.code(409).send({
                    ok: false,
                    error: "Final video not ready; cleanup is not allowed"
                });
            }

            const clientKey = schedule.client?.toString() || "global";
            const prefixes = [
                `newRecordings/${clientKey}/${interviewScheduleId}/segments/`
            ];
            if (clientKey !== "global") {
                prefixes.push(`newRecordings/global/${interviewScheduleId}/segments/`);
            }

            const results = [];
            for (const prefix of prefixes) {
                const res = await deleteFilesByPrefix(prefix);
                results.push({ prefix, ...res });
            }

            return reply.send({
                ok: true,
                interviewScheduleId,
                results
            });
        } catch (err) {
            console.error("[RECORDING] Cleanup error:", err);
            return reply.code(500).send({
                ok: false,
                error: err.message || "Internal server error"
            });
        }
    });



    // ─────────────────────────────────────────────────────────────────────────
    // PLAYBACK PIPELINE  (Firebase only, zero ffmpeg)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Number of chunk signed-URLs returned per batch.
     * Keep small enough for fast first response, large enough to buffer several
     * seconds of playback before the next batch arrives.
     */
    const PLAYBACK_BATCH_SIZE = 50;

    /**
     * Signed-URL TTL for playback chunks.
     * 4 hours is generous – reviewer watches the recording once per session.
     */
    const PLAYBACK_URL_EXPIRY_HOURS = 4;

    /**
     * Internal helper shared by both playback routes.
     * Lists every file under `prefix` from the Firebase bucket,
     * groups them by track name, and sorts each group by filename (seq no).
     *
     * Returns: { [trackName]: FirebaseFile[] }
     */
    async function listAndGroupTracks(storageBucket, prefix) {
        const [allFiles] = await storageBucket.getFiles({ prefix });
        const tracks = {};
        for (const file of allFiles) {
            const relPath = file.name.substring(prefix.length);
            const parts = relPath.split('/');
            if (parts.length >= 2) {
                const trackName = parts[0];
                if (!tracks[trackName]) tracks[trackName] = [];
                tracks[trackName].push(file);
            }
        }
        // Sort each track's files in sequence order (filename = 000000.webm, 000001.webm …)
        for (const name of Object.keys(tracks)) {
            tracks[name].sort((a, b) => a.name.localeCompare(b.name));
        }
        return tracks;
    }

    /**
     * Sign a slice of Firebase File objects and return their URLs.
     * Expiry is set to PLAYBACK_URL_EXPIRY_HOURS from now.
     */
    async function signFiles(files) {
        const expiresAt = new Date(Date.now() + PLAYBACK_URL_EXPIRY_HOURS * 60 * 60 * 1000);
        const urls = await Promise.all(
            files.map(file =>
                file.getSignedUrl({ action: 'read', expires: expiresAt })
                    .then(([url]) => url)
            )
        );
        return urls;
    }

    /**
     * POST /playback-manifest
     *
     * Returns track info, startMs values, and the FIRST batch of signed chunk
     * URLs per track (up to PLAYBACK_BATCH_SIZE). Also returns a `nextCursor`
     * per track so the frontend can call /playback-manifest/next for more.
     *
     * No ffmpeg. No downloads. Resolves in < 2 seconds.
     */
    fastify.post("/playback-manifest", async (request, reply) => {
        try {
            const { interviewScheduleId } = request.body || {};

            if (!interviewScheduleId) {
                return reply.code(400).send({
                    ok: false,
                    error: "Missing interviewScheduleId in request body"
                });
            }

            if (!request.conn) {
                return reply.code(500).send({ ok: false, error: "Database connection not available" });
            }

            // Fetch schedule — only the fields we need
            const schedule = await request.conn.models["InterviewSchedule"]
                .findById(interviewScheduleId)
                .select("client interviewerType recordingMetadata recordingStatus finalizationStatus trackFinalFiles")
                .lean()
                .exec();

            if (!schedule) {
                return reply.code(404).send({ ok: false, error: "Interview schedule not found" });
            }

            const admin = await import("firebase-admin");
            const storageBucket = admin.default.storage().bucket();

            const clientKey = schedule.client?.toString() || "global";
            let basePrefix = `newRecordings/${clientKey}/${interviewScheduleId}/segments/`;

            let tracks = await listAndGroupTracks(storageBucket, basePrefix);

            // Fallback: try global prefix if the per-client one is empty
            if (Object.keys(tracks).length === 0 && clientKey !== "global") {
                const globalPrefix = `newRecordings/global/${interviewScheduleId}/segments/`;
                console.log(`[PLAYBACK-MANIFEST] No files under client prefix, checking global fallback…`);
                tracks = await listAndGroupTracks(storageBucket, globalPrefix);
                if (Object.keys(tracks).length > 0) {
                    basePrefix = globalPrefix;
                }
            }

            if (Object.keys(tracks).length === 0) {
                return reply.code(404).send({
                    ok: false,
                    error: "No recording segments found for this interview"
                });
            }

            // Resolve sync metadata
            const meta = schedule.recordingMetadata || {};
            const interviewerStartTimes = meta.interviewerStartTimes || {};

            const getStartMs = (trackName) => {
                if (trackName === "candidate") return meta.candidateStartMs || 0;
                if (trackName.startsWith("interviewer_")) {
                    const id = trackName.split("_")[1];
                    if (interviewerStartTimes instanceof Map) return interviewerStartTimes.get(id) || 0;
                    return interviewerStartTimes[id] || 0;
                }
                return 0;
            };

            const getExactDurationMs = (trackName) => {
                try {
                    let timeline = [];
                    if (trackName === "candidate") {
                        timeline = meta.candidateTimeline || [];
                    } else if (trackName.startsWith("interviewer_")) {
                        const id = trackName.split("_")[1];
                        const timelines = meta.interviewerTimelines;
                        if (timelines) {
                            if (timelines instanceof Map) {
                                timeline = timelines.get(id) || [];
                            } else {
                                timeline = timelines[id] || [];
                            }
                        }
                    }

                    if (!timeline || timeline.length === 0) return 0;
                    const maxEndMs = timeline.reduce((max, entry) => Math.max(max, entry.endMs || 0), 0);
                    return maxEndMs;
                } catch (e) {
                    console.error(`[PLAYBACK-MANIFEST] Error calculating duration for ${trackName}:`, e);
                    return 0;
                }
            };

            // Build per-track response: sign only the first PLAYBACK_BATCH_SIZE chunks
            const trackResults = await Promise.all(
                Object.entries(tracks).map(async ([name, files]) => {
                    const totalChunks = files.length;
                    const firstBatch = files.slice(0, PLAYBACK_BATCH_SIZE);
                    const firstChunks = await signFiles(firstBatch);
                    const nextCursor = firstBatch.length; // = min(PLAYBACK_BATCH_SIZE, totalChunks)
                    const type = name === "candidate" ? "candidate" : "interviewer";
                    const interviewerId = name.startsWith("interviewer_") ? name.split("_")[1] : null;

                    // Stage 2: check if a final merged file already exists for this track
                    const tfMap = schedule.trackFinalFiles;
                    let stage2Url = null;
                    if (tfMap) {
                        const info = tfMap instanceof Map ? tfMap.get(name) : (tfMap[name] || null);
                        stage2Url = info?.finalUrl || null;
                    }

                    const exactDurationMs = getExactDurationMs(name);

                    return {
                        name,
                        type,
                        ...(interviewerId && { interviewerId }),
                        startMs: getStartMs(name),
                        exactDurationMs,
                        totalChunks,
                        firstChunks,
                        nextCursor,
                        done: nextCursor >= totalChunks,
                        stage2Url,
                        stage2Ready: !!stage2Url,
                    };
                })
            );

            console.log(
                `[PLAYBACK-MANIFEST][${interviewScheduleId}] Manifest built: ` +
                trackResults.map(t => `${t.name}(${t.totalChunks} chunks)`).join(", ")
            );

            return reply.send({
                ok: true,
                interviewerType: schedule.interviewerType || "AI",
                tracks: trackResults
            });
        } catch (err) {
            console.error("[PLAYBACK-MANIFEST] Error:", err);
            return reply.code(500).send({
                ok: false,
                error: err.message || "Internal server error"
            });
        }
    });

    /**
     * POST /playback-manifest/next
     *
     * Returns the next batch of signed chunk URLs for a single track.
     * The cursor is just an integer offset (stateless — no server-side session).
     *
     * Body: { interviewScheduleId, trackName, cursor }
     */
    fastify.post("/playback-manifest/next", async (request, reply) => {
        try {
            const { interviewScheduleId, trackName, cursor } = request.body || {};

            if (!interviewScheduleId || !trackName || cursor === undefined || cursor === null) {
                return reply.code(400).send({
                    ok: false,
                    error: "Missing required fields: interviewScheduleId, trackName, cursor"
                });
            }

            const cursorInt = parseInt(cursor, 10);
            if (Number.isNaN(cursorInt) || cursorInt < 0) {
                return reply.code(400).send({ ok: false, error: "cursor must be a non-negative integer" });
            }

            if (!request.conn) {
                return reply.code(500).send({ ok: false, error: "Database connection not available" });
            }

            const schedule = await request.conn.models["InterviewSchedule"]
                .findById(interviewScheduleId)
                .select("client")
                .lean()
                .exec();

            if (!schedule) {
                return reply.code(404).send({ ok: false, error: "Interview schedule not found" });
            }

            const admin = await import("firebase-admin");
            const storageBucket = admin.default.storage().bucket();

            const clientKey = schedule.client?.toString() || "global";
            let basePrefix = `newRecordings/${clientKey}/${interviewScheduleId}/segments/`;

            let tracks = await listAndGroupTracks(storageBucket, basePrefix);

            // Fallback to global prefix
            if (!tracks[trackName] && clientKey !== "global") {
                const globalPrefix = `newRecordings/global/${interviewScheduleId}/segments/`;
                tracks = await listAndGroupTracks(storageBucket, globalPrefix);
            }

            const trackFiles = tracks[trackName];
            if (!trackFiles || trackFiles.length === 0) {
                return reply.code(404).send({
                    ok: false,
                    error: `Track "${trackName}" not found for this interview`
                });
            }

            const totalChunks = trackFiles.length;
            const batch = trackFiles.slice(cursorInt, cursorInt + PLAYBACK_BATCH_SIZE);

            if (batch.length === 0) {
                // cursor is already past the end — nothing more to send
                return reply.send({
                    ok: true,
                    trackName,
                    chunks: [],
                    nextCursor: cursorInt,
                    done: true
                });
            }

            const chunks = await signFiles(batch);
            const nextCursor = cursorInt + batch.length;
            const done = nextCursor >= totalChunks;

            console.log(
                `[PLAYBACK-NEXT][${interviewScheduleId}] Track=${trackName} ` +
                `cursor=${cursorInt}→${nextCursor}/${totalChunks} done=${done}`
            );

            return reply.send({
                ok: true,
                trackName,
                chunks,
                nextCursor,
                done
            });
        } catch (err) {
            console.error("[PLAYBACK-NEXT] Error:", err);
            return reply.code(500).send({
                ok: false,
                error: err.message || "Internal server error"
            });
        }
    });

    /**
     * POST /playback-manifest/seek
     *
     * Finds the chunk corresponding to a given timestamp (seekToSec)
     * using the timeline index in recordingMetadata, and returns the next batch of chunks.
     *
     * Body: { interviewScheduleId, trackName, seekToSec }
     */
    fastify.post("/playback-manifest/seek", async (request, reply) => {
        try {
            const { interviewScheduleId, trackName, seekToSec } = request.body || {};

            if (!interviewScheduleId || !trackName || seekToSec === undefined || seekToSec === null) {
                return reply.code(400).send({
                    ok: false,
                    error: "Missing required fields: interviewScheduleId, trackName, seekToSec"
                });
            }

            const targetMs = Number(seekToSec) * 1000;
            if (Number.isNaN(targetMs) || targetMs < 0) {
                return reply.code(400).send({ ok: false, error: "seekToSec must be a non-negative number" });
            }

            if (!request.conn) {
                return reply.code(500).send({ ok: false, error: "Database connection not available" });
            }

            const schedule = await request.conn.models["InterviewSchedule"]
                .findById(interviewScheduleId)
                .select("client recordingMetadata")
                .lean()
                .exec();

            if (!schedule) {
                return reply.code(404).send({ ok: false, error: "Interview schedule not found" });
            }

            // 1. Resolve timeline array for this track
            const meta = schedule.recordingMetadata || {};
            let timeline = [];

            if (trackName === 'candidate' && Array.isArray(meta.candidateTimeline)) {
                timeline = meta.candidateTimeline;
            } else if (trackName.startsWith('interviewer_')) {
                const interviewerId = trackName.split('_')[1];
                if (interviewerId && meta.interviewerTimelines) {
                    // Support Map or plain object
                    timeline = (meta.interviewerTimelines instanceof Map)
                        ? meta.interviewerTimelines.get(interviewerId)
                        : meta.interviewerTimelines[interviewerId];
                }
            }

            if (!Array.isArray(timeline)) timeline = [];

            // 2. Find the chunk that covers the target timestamp
            let targetCursor = 0;
            let resolvedStartMs = 0;
            if (timeline.length > 0) {
                // Timeline might be unsorted due to out-of-order uploads, sort it first
                const sortedTimeline = [...timeline].sort((a, b) => a.seqNo - b.seqNo);

                // Find chunk where startMs <= targetMs and endMs > targetMs
                // Or if targetMs is past the last chunk, cap it at the last valid chunk
                let foundChunk = sortedTimeline.find(c => targetMs >= c.startMs && targetMs < c.endMs);

                if (foundChunk) {
                    targetCursor = foundChunk.seqNo;
                    resolvedStartMs = foundChunk.startMs;
                } else {
                    // If targetMs is past the recorded chunks, give them the last chunk
                    const lastChunk = sortedTimeline[sortedTimeline.length - 1];
                    if (targetMs >= lastChunk.endMs) {
                        targetCursor = lastChunk.seqNo;
                        resolvedStartMs = lastChunk.startMs;
                    } else {
                        // Fallback (e.g. gap in recording)
                        const closest = sortedTimeline.filter(c => c.startMs <= targetMs);
                        if (closest.length > 0) {
                            targetCursor = closest[closest.length - 1].seqNo;
                            resolvedStartMs = closest[closest.length - 1].startMs;
                        } else {
                            targetCursor = 0;
                            resolvedStartMs = 0;
                        }
                    }
                }
            } else {
                console.warn(`[PLAYBACK-SEEK][${interviewScheduleId}] No timeline index found for ${trackName}, falling back to cursor 0`);
            }

            // 3. Fetch chunks starting from targetCursor (similar logic to /next)
            const admin = await import("firebase-admin");
            const storageBucket = admin.default.storage().bucket();

            const clientKey = schedule.client?.toString() || "global";
            let basePrefix = `newRecordings/${clientKey}/${interviewScheduleId}/segments/`;

            let tracks = await listAndGroupTracks(storageBucket, basePrefix);

            // Fallback to global prefix
            if (!tracks[trackName] && clientKey !== "global") {
                const globalPrefix = `newRecordings/global/${interviewScheduleId}/segments/`;
                tracks = await listAndGroupTracks(storageBucket, globalPrefix);
            }

            const trackFiles = tracks[trackName];
            if (!trackFiles || trackFiles.length === 0) {
                return reply.code(404).send({
                    ok: false,
                    error: `Track "${trackName}" not found for this interview`
                });
            }

            const totalChunks = trackFiles.length;

            // Ensure targetCursor is within bounds
            const safeCursorInt = Math.min(Math.max(0, targetCursor), Math.max(0, totalChunks - 1));
            const batch = trackFiles.slice(safeCursorInt, safeCursorInt + PLAYBACK_BATCH_SIZE);

            if (batch.length === 0) {
                return reply.send({
                    ok: true,
                    trackName,
                    chunks: [],
                    nextCursor: safeCursorInt,
                    done: true
                });
            }

            const chunks = await signFiles(batch);
            const nextCursor = safeCursorInt + batch.length;
            const done = nextCursor >= totalChunks;

            console.log(
                `[PLAYBACK-SEEK][${interviewScheduleId}] Track=${trackName} seek=${seekToSec}s ` +
                `resolved to seqNo=${safeCursorInt} → sending ${batch.length} chunks up to ${nextCursor}/${totalChunks}`
            );

            return reply.send({
                ok: true,
                trackName,
                chunks,
                nextCursor, // Frontend uses this to continue fetching via /next
                resolvedStartMs,
                done
            });
        } catch (err) {
            console.error("[PLAYBACK-SEEK] Error:", err);
            return reply.code(500).send({
                ok: false,
                error: err.message || "Internal server error"
            });
        }
    });
}

export default recordingRoutes;