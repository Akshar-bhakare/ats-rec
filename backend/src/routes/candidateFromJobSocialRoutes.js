import CandidateService from '../services/candidateService.js';
import { getClientDbConn, getDBNameByEmail } from '../utils/clientDbUtils.js';
import { aiCallTriggerer, createSchedule } from './aiCallRoutes.js';



export const setupAuthAndOtherDetails = async (req, authEmail) => {
    const dbName = await getDBNameByEmail(authEmail);
    const dbConn = await getClientDbConn(dbName);
    req.conn = dbConn;
    req.user = await dbConn.models["User"].findOne({ email: authEmail }).lean().exec();
    req.client = req.user?.clientId || req.user?.client || req.user?._id;
}


export default async function candidateFromJobSocialRoutes(fastify) {
    const candidateSvc = new CandidateService();

    /* ------------------------------ UPLOAD CV (service) ------------------------------ */
    fastify.post('/upload/', async (req, reply) => {
        const data = await candidateSvc.uploadCandidateCVs(req);
        return reply.code(200).send(data);
    });

    /* ------------------------------ BULK CREATE (service) ------------------------------ */
    fastify.post('/multiple/', async (req, reply) => {
        await setupAuthAndOtherDetails(req, req.body.jobSharer.email);
        let res = await candidateSvc.createMultipleCandidates(req);
        if (Object.keys(res).length === 0) return reply.code(204).send(res);
        if (res?.validated === "successful") {
            res = {
                ...res,
                ...(await req.conn.models["Candidate"].findOne({ email: req?.body?.["email of Candidate 0"] }).lean().exec() || {})
            }
        }

        return reply.code(201).send(res);
    });

    /* ------------------------------ SHARE CONTEXT (public, no auth cookie) --------------- */
    fastify.get('/share/context/:jobId', async (req, reply) => {
        try {
            const { jobId } = req.params;
            const email = req.query.email || req.query.e;
            if (!jobId || !email) {
                return reply.code(400).send({ ok: false, error: 'jobId and email are required' });
            }

            await setupAuthAndOtherDetails(req, email);

            const Job = req.conn.models['Job'];
            if (!Job) return reply.code(500).send({ ok: false, error: 'Job model not available' });

            const job = await Job.findById(jobId).lean().exec();
            if (!job) return reply.code(404).send({ ok: false, error: 'Job not found' });

            const User = req.conn.models['User'];
            const sharer = User ? await User.findOne({ email }).lean().exec() : null;

            const snippet = (job.description || job.summary || job.notes || job.jobObjective || job.title || '')
                .replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 280);

            return reply.send({
                ok: true,
                jobId: String(job._id),
                jobTitle: job.title || 'Job opening',
                companyName: job.company?.name || job.company || '',
                jobSnippet: snippet,
                jobSharer: {
                    id: String(sharer?._id || ''),
                    name: sharer?.fullName || [sharer?.firstName, sharer?.lastName].filter(Boolean).join(' ') || sharer?.name || sharer?.email || 'Hiring Team',
                    role: sharer?.role || '',
                    email: email,
                },
            });
        } catch (err) {
            console.error('[SHARE CONTEXT] Error:', err?.message || err);
            return reply.code(500).send({ ok: false, error: 'Failed to load share context' });
        }
    });

    /* ------------------------------ SCREENING CALL (service) ------------------------------ */
    fastify.post('/screening/call/', async (req, reply) => {
        try {

            await setupAuthAndOtherDetails(req, req?.body?.sharedBy?.email);
            await req.conn.models?.["Candidate"].findOneAndUpdate({
                _id: req?.body?.candidate?._id,
            },
                {
                    sourcePlatform: req?.body?.screening?.source,
                    sourceExtraInfo: req?.body?.screening?.referralDetails + "\n\n" + req?.body?.screening?.notes,
                }
            );
            if (req?.body?.screening?.callPreference === "schedule" && req?.body?.screening?.callSchedule) {

                const res = await createSchedule(
                    [{ _id: req?.body?.candidate?._id, jobId: req?.body?.jobId }],
                    req?.body?.screening?.callSchedule,
                    req
                );
                return reply.code(201).send(res);
            } else if (req?.body?.screening?.callPreference === "now") {
                let res = await aiCallTriggerer(req?.body?.candidate?._id, req?.body?.jobId, req, reply);
                if (!res) {
                    res = {
                        ok: true,
                        code: 201,
                        message: "AI Call initiated successfully...",
                    };
                }
                return res;
            }
        } catch (err) {
            return reply.code(201).send({
                ok: false,
                code: 400,
                message: "Error in saving and scheduling details: " + err?.message,
                details: {
                    error: err
                }
            });

        }
    });


}
