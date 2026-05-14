import CandidateService from '../services/candidateService.js';
import { setupAuthAndOtherDetails } from './candidateFromJobSocialRoutes.js';


const svc = new CandidateService();

export async function candidateRoutesWithoutAuth(fastify) {
    /* ------------------------------ TRACKER (service) ------------------------------ */
    fastify.get('/tracker/demo/', async (req, reply) => {
        try {
            if (!(req.query.callUUID.includes('call_simulation'))) throw new Error("Invalid call id...");

            await setupAuthAndOtherDetails(req, (process.env.NODE_ENV === "production" ? "support@applycup.com" : "admin@aiselekt.com"));
            const buffer = await svc.generateTrackerExcel(req);
            reply
                .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                .header('Content-Disposition', 'attachment; filename="candidates_tracker.xlsx"')
                .send(buffer);
        } catch (err) {
            return reply.code(400).send({ error: err?.message || 'Failed to generate tracker' });
        }
    });

}


export default async function candidateRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.post('/vector-search', async (req, reply) => {
        console.log("\n=============== [ROUTE][VECTOR] REQUEST START ===============");

        try {
            const { query, limit = 20 } = req.body || {};

            console.log("[ROUTE][VECTOR] Incoming query:", query);
            console.log("[ROUTE][VECTOR] Limit:", limit);

            if (!query) {
                console.log("[ROUTE][VECTOR][ERROR] Missing 'query' field");
                return reply.code(400).send({ error: "query is required" });
            }

            console.log("[ROUTE][VECTOR] Calling service.runVectorCandidateSearch...");
            const result = await svc.runVectorCandidateSearch(query, req, limit);

            if (!result?.ok) {
                console.log("[ROUTE][VECTOR][ERROR] Service returned an error:", result?.error);
                return reply.code(500).send(result);
            }

            console.log(`[ROUTE][VECTOR] ✔ Service returned ${result.items?.length || 0} items`);

            console.log("=============== [ROUTE][VECTOR] REQUEST END ===============\n");
            return reply.code(200).send(result);

        } catch (err) {
            console.error("[ROUTE][VECTOR][FATAL ERROR]:", err);
            return reply.code(500).send({
                ok: false,
                error: err.message || "Unknown error",
                stage: "route_fatal"
            });
        }
    });

    /* ------------------------------ CREATE (service) ------------------------------ */
    fastify.post('/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const res = await svc.createCandidate(req?.body || {}, req.user, req.client, req.conn);
        if (!res?.ok) {
            return reply
                .code(res?.code || 400)
                .send({ error: res?.message, details: res?.details });
        }
        return reply.code(res?.code || 201).send(res?.details?.candidate);
    });

    /* ------------------------------ UPLOAD CV (service) ------------------------------ */
    fastify.post('/upload/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const data = await svc.uploadCandidateCVs(req);
        return reply.code(200).send(data);
    });

    /* ------------------------------ BULK CREATE (service) ------------------------------ */
    fastify.post('/multiple/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const res = await svc.createMultipleCandidates(req);
        if (Object.keys(res).length === 0) return reply.code(204).send(res);
        return reply.code(201).send(res);
    });

    /* ------------------------------ TRACKER (service) ------------------------------ */
    fastify.get('/tracker/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        try {
            const buffer = await svc.generateTrackerExcel(req);
            reply
                .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                .header('Content-Disposition', 'attachment; filename="candidates_tracker.xlsx"')
                .send(buffer);
        } catch (err) {
            return reply.code(400).send({ error: err?.message || 'Failed to generate tracker' });
        }
    });

    /* ------------------------------ STAGE REPORT (service) ------------------------------ */
    fastify.get('/stage-report/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: 'This service unavailable for this user...' });
        }

        try {
            const buffer = await svc.generateStageWiseReportExcel(req);
            reply
                .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                .header('Content-Disposition', 'attachment; filename="candidates_stage_report.xlsx"')
                .send(buffer);
        } catch (err) {
            return reply.code(400).send({ error: err?.message || 'Failed to generate stage report' });
        }
    });

    /* ------------------------------ LIST (service) ------------------------------ */
    fastify.get('/', async (req, reply) => {
        const listRes = await svc.getCandidates({ ...(req?.query || {}), isArchived: false }, req?.user, req?.client, req?.conn);
        if (listRes?.meta) {
            return reply.code(listRes?.code || 200).send(listRes);
        }
        return reply.code(listRes?.code || 200).send(listRes?.items || []);
    });

    /* ------------------------------ READ (service) ------------------------------ */
    fastify.get('/:id', async (req, reply) => {
        const detailRes = await svc.getCandidateDetails({ id: req.params.id, ...(req?.query || {}) }, req.user, req.client, req.conn);

        // Distinguish archived from truly not-found
        if (!detailRes?.ok && detailRes?.code === 404) {
            const isArchived = await svc.isCandidateArchived(req.params.id, req.client, req.conn);
            if (isArchived) {
                return reply.code(410).send({ ok: false, code: 410, message: 'Candidate is archived', _id: req.params.id });
            }
        }

        return reply
            .code(detailRes?.code || 200)
            .send({ ...(detailRes?.details?.candidate || detailRes), _id: req.params.id });
    });

    /* ------------------------------ UPDATE (multipart, service) ------------------------------ */
    fastify.put('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const res = await svc.updateCandidateFromMultipart(req.params.id, req);
        console.log(
            "cand:: res: ", res
        );

        if (!res?.ok) return reply.code(res?.code || 400).send({ message: res?.message, error: res?.message, details: res?.details });

        return reply.code(200).send(res.details.updated);
    });

    /* ------------------------------ DELETE -> ARCHIVE (service) ------------------------------ */
    fastify.delete('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const res = await svc.archiveCandidate({ id: req.params.id }, req.user, req.client, req.conn);
        if (!res?.ok) return reply.code(res?.code || 400).send({ error: res?.message });
        return reply.code(200).send({ success: true });
    });

    /* ------------------------------ ASSIGN JOBS (service) ------------------------------ */
    fastify.post('/assign-job', async (req, reply) => {
        const result = await svc.assignJobsToCandidates(req.body || {}, req);
        return reply.code(result?.code || (result?.ok ? 200 : 400)).send(result?.ok ? { success: true, updated: result.updated, skipped: result.skipped } : { error: result?.message, skipped: result?.skipped });
    });

    /* ------------------------------ ARCHIVED LIST (service) ------------------------------ */
    fastify.get('/archived', async (req, reply) => {
        const res = await svc.getCandidates({ ...(req?.query || {}), isArchived: true }, req?.user, req.client, req.conn);
        if (res?.meta) {
            return reply.code(res?.code || 200).send(res);
        }
        return reply.code(res?.code || 200).send(res?.items || []);
    });

    /* ------------------------------ ARCHIVE / UNARCHIVE (service) ------------------------------ */
    fastify.put('/:id/archive', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const res = await svc.updateCandidate({ id: req.params.id, isArchived: true }, req.user, req.client, req.conn, true);
        return reply.code(res?.code || 200).send(res?.details?.updated || res);
    });

    fastify.put('/:id/unarchive', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const res = await svc.unarchiveCandidate({ id: req.params.id }, req.user, req.client, req.conn);
        return reply.code(res?.code || 200).send(res?.details?.updated || res);
    });

}
