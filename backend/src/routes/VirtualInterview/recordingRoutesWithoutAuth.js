import { uploadBuffer } from "../../utils/storageAdapter.js";
import fs from "fs";

const fieldValue = (v) => {
    if (v == null) return v;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v && "value" in v) return v.value; // multipart field obj
    return String(v);
};

/**
 * Recording Routes WITHOUT authentication for public WebRTC interviews.
 * These routes are accessed by candidates via public interview links.
 */
async function recordingRoutesWithoutAuth(fastify, options) {
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
     * NO AUTHENTICATION REQUIRED - uses candidateId/jobId from request body
     */
    fastify.post("/chunk", async (request, reply) => {
        try {
            let file = null;

            console.log("[RECORDING] Starting chunk processing (no auth)...");

            // -------- 1) Extract file safely --------
            let fileBody = null;
            let rest = {};

            if (request.body) {
                const body = request.body;
                fileBody = body.file;
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

            console.log(
                "[RECORDING] File status:",
                file ? `Present (${file.buffer?.length ?? 0} bytes)` : "Missing"
            );

            const interviewScheduleId = cleanFields.interviewScheduleId;
            const candidateId = cleanFields.candidateId;
            const jobId = cleanFields.jobId;
            const trackType = cleanFields.trackType;
            const mimeType = cleanFields.mimeType;

            // -------- 3) Validate --------
            if (
                !interviewScheduleId ||
                !candidateId ||
                !jobId ||
                !trackType ||
                seqNo === undefined ||
                seqNo === null ||
                Number.isNaN(seqNo) ||
                !file?.buffer
            ) {
                return reply.code(400).send({
                    ok: false,
                    error: "Missing required fields: interviewScheduleId, candidateId, jobId, trackType, seqNo, and file are required",
                });
            }

            //----------------------------------------------------------------------
            // 4) Determine clientKey and get proper tenant database connection
            //----------------------------------------------------------------------
            // Strategy: Look up the candidate in the default DB to find their client,
            // then use that client's tenant database to find the interview schedule
            const { getClientDbConn } = await import("../../utils/clientDbUtils.js");
            const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME;

            let clientKey = "global";

            try {
                // Step 1: Connect to default database
                const defaultConn = await getClientDbConn(DEFAULT_DB_NAME);

                // Step 2: Find the candidate to get their client ID
                const candidate = await defaultConn.models["Candidate"]
                    .findById(candidateId)
                    .select("client")
                    .lean()
                    .exec();

                if (candidate?.client) {
                    clientKey = candidate.client.toString();
                    console.log(`[RECORDING] Found candidate's client: ${clientKey} (no auth)`);

                    // Step 3: Connect to the tenant database using the client ID
                    const tenantConn = await getClientDbConn(clientKey);

                    // Step 4: Verify the interview schedule exists in the tenant database
                    const schedule = await tenantConn.models["InterviewSchedule"]
                        .findById(interviewScheduleId)
                        .select("_id")
                        .lean()
                        .exec();

                    if (schedule) {
                        console.log(`[RECORDING] Verified schedule in tenant DB for client: ${clientKey} (no auth)`);
                    } else {
                        console.warn(`[RECORDING] Schedule ${interviewScheduleId} not found in tenant DB for client ${clientKey} (no auth)`);
                    }
                } else {
                    console.warn(`[RECORDING] Candidate ${candidateId} not found in default DB, using 'global' as clientKey (no auth)`);
                }
            } catch (err) {
                console.error("[RECORDING] Error looking up client from candidate (no auth):", err);
                // Continue with 'global' as fallback
            }

            // -------- 4b) Handle trackStartMs (if provided) --------
            // Use raw rest.trackStartMs because cleanFields doesn't include it
            const trackStartMsVal = fieldValue(rest.trackStartMs);
            if (trackStartMsVal) {
                const startMs = Number(trackStartMsVal);
                if (!Number.isNaN(startMs)) {
                    try {
                        const { getClientDbConn } = await import("../../utils/clientDbUtils.js");
                        const connToUse = await getClientDbConn(clientKey === 'global' ? process.env.DEFAULT_DB_NAME : clientKey);

                        const updateField = trackType === 'candidate'
                            ? 'recordingMetadata.candidateStartMs'
                            : 'recordingMetadata.interviewerStartMs';

                        console.log(`[RECORDING] Attempting to update ${updateField} to ${startMs}. ClientKey: ${clientKey}`);

                        const result = await connToUse.models["InterviewSchedule"].updateOne(
                            { _id: interviewScheduleId },
                            { $set: { [updateField]: startMs } }
                        );
                        console.log(`[RECORDING] Updated ${trackType} start time match: ${result.matchedCount}, mod: ${result.modifiedCount}`);
                    } catch (dbErr) {
                        console.error(`[RECORDING] Failed to update start time in no-auth route:`, dbErr);
                    }
                } else {
                    console.warn(`[RECORDING] trackStartMs is NaN: ${trackStartMsVal} (raw: ${rest.trackStartMs})`);
                }
            } else if (String(seqNo) === "0") {
                console.warn(`[RECORDING] Chunk 0 received but NO trackStartMs in body. Keys: ${Object.keys(rest)}`);
            }

            // -------- 5) Build remote path --------
            const paddedSeqNo = String(seqNo).padStart(6, "0");
            //const remotePath = `webrtcRecordings/${clientKey}/${interviewScheduleId}/segments/${trackType}/${paddedSeqNo}.webm`;
            const remotePath = `newRecordings/${clientKey}/${interviewScheduleId}/segments/${trackType}/${paddedSeqNo}.webm`;

            // -------- 6) Upload (pass ONLY primitives + buffer) --------
            await uploadBuffer(file.buffer, remotePath, mimeType || "video/webm");

            console.log(`[RECORDING] Uploaded chunk (no auth): ${remotePath} (${file.buffer.length} bytes)`);

            return reply.send({
                ok: true,
                trackType,
                seqNo,
                path: remotePath,
            });
        } catch (err) {
            console.error("[RECORDING] Chunk upload error (no auth):", err);
            return reply.code(500).send({
                ok: false,
                error: err.message || "Internal server error",
            });
        }
    });
}

export default recordingRoutesWithoutAuth;
