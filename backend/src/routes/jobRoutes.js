import dotenv from 'dotenv';
import mongoose from 'mongoose';
import JobService from '../services/jobService.js';
import RelevancyService from '../services/relevancyService.js';   // ★ NEW
import { getClientDbConn } from '../utils/clientDbUtils.js';
import { requirePermission } from '../utils/permissionUtils.js';

/**
 * Transform relevancy row for display:
 * Show "N/A" for fields not applicable to resume-only stage
 */
function transformRelevancyForDisplay(row) {
    if (!row) return row;

    const result = { ...row };

    // Fields only calculated in post-call stage
    const postCallOnlyFields = [
        'communicationRelevancy',
        'salaryRelevancy',
        'noticePeriodRelevancy',
        'interestRelevancy'
    ];

    // If all conversation fields are 0 or undefined, it's resume-only stage
    const isResumeOnly = postCallOnlyFields.every(field => !result[field] || result[field] === 0);

    if (isResumeOnly) {
        postCallOnlyFields.forEach(field => {
            result[field] = 'N/A';
        });
    }

    return result;
}


dotenv.config();
const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME;
const globalConn = await getClientDbConn(DEFAULT_DB_NAME);
const svc = new JobService();

export async function jobRoutesWithoutAuth(fastify) {

    fastify.post('/generate-boolean/demo/', async (req, reply) => {
        const { skills, secondarySkills, excludeJunior, userEmail, demoOf } = req.body;

        let existingDemoUsr;
        try {
            if (userEmail && demoOf) {
                existingDemoUsr = await globalConn?.models?.DemoLeads?.findOne?.({ email: userEmail, demoOf });
                if (existingDemoUsr) {
                    if (existingDemoUsr?.numOfBolSrhPromptsUsed >= existingDemoUsr?.bolSrhPromptsLimit) {
                        throw new Error({
                            ok: false,
                            code: 400,
                            message: "Allowed limit(" + existingDemoUsr?.bolSrhPromptsLimit + ") exausted...",
                            details: {
                                numOfBolSrhPromptsUsed: existingDemoUsr?.numOfBolSrhPromptsUsed
                            }
                        });

                    }
                }
            };

            const booleanString = await svc.generateBooleanString({
                skills,
                req,
                secondarySkills,
                excludeJunior
            });

            if (userEmail && demoOf && existingDemoUsr) {
                await globalConn.models.BooleanSearchFeedback.create({
                    userEmail,
                    skillPrompt: skills,
                    aiResponse: booleanString,
                });

                existingDemoUsr.numOfBolSrhPromptsUsed += 1;

                await existingDemoUsr.save();
            }

            return reply.send({ success: true, booleanString });
        } catch (err) {
            fastify.log.error(err);
            return reply.code(400).send({
                success: false,
                message: err.message || 'Failed to generate Boolean string',
            });
        }
    });


    fastify.post('/boolean/search/feedback/', async (req, reply) => {
        const { skills: skillPrompt, aiResponse, userEmail, feedbackNum } = req.body;
        let existingDoc;
        try {
            if (userEmail && Array.isArray(skillPrompt) && skillPrompt?.length > 0) {
                existingDoc = await globalConn?.models?.BooleanSearchFeedback.findOne({ userEmail, skillPrompt, aiResponse }) || await globalConn?.models?.BooleanSearchFeedback.create({ userEmail, skillPrompt, aiResponse });
                if (existingDoc) {
                    existingDoc.feedbackNum = feedbackNum;
                    await existingDoc.save();
                }
                //  else {
                //     throw new Error({
                //         ok: false,
                //         code: 404,
                //         message: "Invaild user..."
                //     });

                // }
            } else {

                throw new Error({
                    ok: false,
                    code: 400,
                    message: "Invaild request..."
                });
            };

            return reply.send({ success: true });
        } catch (err) {
            fastify.log.error(err);
            return reply.code(400).send({
                success: false,
                message: err.message || 'Failed to save Boolean string feedback...',
            });
        }
    });

}


export default async function jobRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate);

    // CREATE
    fastify.post('/', { preHandler: [requirePermission('job')] }, async (req, reply) => {
        const jobCreRes = await svc.createJob(req.body, req.user, req.client, req.conn);
        if (!jobCreRes?.ok) {
            return reply.code(jobCreRes?.code || 400).send(jobCreRes);
        }
        return reply.code(jobCreRes?.code || 201).send(jobCreRes?.details?.job);
    });

    fastify.get('/', async (req, reply) => {
        const jobListRes = await svc.getJobs(req?.query || {}, req?.user, req.client, req.conn);
        if (jobListRes?.meta) {
            return reply.code(jobListRes?.code || 200).send(jobListRes);
        }
        return reply.code(jobListRes?.code || 200).send(jobListRes?.items);
    });

    // READ
    fastify.get('/:id', async (req, reply) => {
        const jobDetailRes = await svc.getJobDetails({ id: req.params.id }, req.user, req.client, req.conn)
        return reply.code(jobDetailRes?.code || 200).send({ ...jobDetailRes?.details?.job || jobDetailRes, _id: req.params.id });
    });

    // UPDATE
    fastify.put('/:id', { preHandler: [requirePermission('job')] }, async (req, reply) => {
        const { id } = req.params;
        const jobUpdateRes = await svc.updateJob({ id, ...req?.body || {} }, req.user, req.client, req.conn);
        return reply.code(jobUpdateRes?.code || 200).send(jobUpdateRes?.details?.updated || jobUpdateRes);
    });

    // DELETE
    fastify.delete('/:id', { preHandler: [requirePermission('job')] }, async (req, reply) => {
        const { id } = req.params;
        try {
            await svc.archiveJob({ id }, req.user, req.client, req.conn)
            return reply.code(204).send();
        } catch (err) {
            return reply.code(err?.code || 400).send(err.message);
        }
    });

    fastify.post('/generate-boolean', async (req, reply) => {
        const { skills, secondarySkills, excludeJunior } = req.body;

        try {
            const booleanString = await svc.generateBooleanString({
                skills,
                req,
                secondarySkills,
                excludeJunior
            });

            return reply.send({ success: true, booleanString });
        } catch (err) {
            fastify.log.error(err);
            return reply.code(400).send({
                success: false,
                message: err.message || 'Failed to generate Boolean string',
            });
        }
    });

    fastify.post('/generate-JobDescription', async (req, reply) => {
        const {
            title,
            skills,
            experience = {},
            locations = [],
            salary,
            workMode,
            educationDetails = []
        } = req.body;

        try {
            const jobDescription = await svc.generateJobDescription({
                title,
                skills,
                req,
                experience,
                locations,
                salaryRange: salary,
                workMode,
                educationDetails
            });
            return reply.send({ success: true, jobDescription });
        } catch (err) {
            return reply.code(400).send({
                success: false,
                message: err.message || 'Job description generation failed'
            });
        }
    });

    // LIST (archived) — used by Recycle Bin
    fastify.get('/archived', async (req, reply) => {
        // const { resolveCompanies } = req.query;

        // const filter = {
        //     isArchived: true,
        //     client: req.client
        // };

        // let projection;
        // if (req.query.fields) {
        //     const fields = req.query.fields
        //         .split(',')
        //         .map(f => f.trim())
        //         .filter(Boolean)
        //         .join(' ');
        //     if (fields) projection = fields;
        // }

        // const populates = [];
        // if ('getEvents' in req.query || 'viewMode' in req.query) {
        //     populates.push({
        //         path: 'eventIds',
        //         select: 'eventAt eventName',
        //         populate: {
        //             path: 'eventName',
        //             model: 'EventName',
        //             select: 'name userId',
        //             match: { name: 'Created' }
        //         }
        //     });
        // }
        // if (resolveCompanies === 'true') {
        //     populates.push({ path: 'company', select: 'name' });
        // }
        // populates.push({ path: 'createdBy', select: 'firstName lastName email' });

        // let jobsList = await req.conn.models['Job'].find(filter, projection).populate(populates).lean().exec();

        // if (req?.query?.viewMode === 'me') {
        //     jobsList = jobsList.filter(job =>
        //         job.eventIds?.some(event => event.eventName?.name && event.eventName?.userId && event.eventName?.name === 'Created' && `${event.eventName?.userId}` === `${req.user._id}`
        //         )
        //     );
        // }

        // const nameFromUser = (u) =>
        //     u ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || '—') : '—';

        // jobsList = jobsList.map(job => {
        //     const createdByName = nameFromUser(job.createdBy);
        //     job.eventIds = [];
        //     return { ...job, id: job._id, createdByName };
        // });

        // return reply.send(jobsList);


        const jobListRes = await svc.getJobs({ ...req?.query || {}, isArchived: true }, req?.user, req.client, req.conn);
        if (jobListRes?.meta) {
            return reply.code(jobListRes?.code || 200).send(jobListRes);
        }
        return reply.code(jobListRes?.code || 200).send(jobListRes?.items);
    });

    // UNARCHIVE — used by Recycle Bin page
    fastify.put('/:id/unarchive', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        // const { id } = req.params;
        // if (!mongoose.Types.ObjectId.isValid(id)) {
        //     return reply.code(400).send({ error: 'Invalid job ID format' });
        // }
        // const updated = await req.conn.models['Job'].findOneAndUpdate(
        //     { _id: id, client: req.client },
        //     { $set: { isArchived: false } },
        //     { new: true }
        // ).lean();
        // if (!updated) return reply.code(404).send({ error: 'Job not found' });
        // return reply.send(updated);

        const { id } = req.params;
        const jobUpdateRes = await svc.updateJob({ id, isArchived: false }, req.user, req.client, req.conn, true);
        return reply.code(jobUpdateRes?.code || 200).send(jobUpdateRes?.details?.updated || jobUpdateRes);
    });

    // 🔎 Relevant candidates for a job (scored)
    // Now supports includeApplied=true to also return candidates who already applied.
    fastify.get('/:id/relevant-candidates', async (req, reply) => {
        const { id } = req.params;
        const conn = req.conn;
        const client = req.client;
        const user = req.user;

        const includeApplied =
            String(req.query?.includeApplied || '').toLowerCase() === 'true';

        fastify.log.info(
            `[relevant-candidates] start jobId=${id}, includeApplied=${includeApplied}`
        );

        if (!mongoose.Types.ObjectId.isValid(id)) {
            fastify.log.warn('[relevant-candidates] invalid job id');
            return reply.code(400).send({ error: 'Invalid job ID format' });
        }

        const Job = conn.models['Job'];
        const CandidateATS = conn.models['CandidateATS'];
        const RelevancyRecord = conn.models['RelevancyRecord'];
        const Candidate = conn.models['Candidate'];

        const job = await Job.findOne({ _id: id, client }).lean();
        if (!job) {
            fastify.log.warn('[relevant-candidates] job not found');
            return reply.code(404).send({ error: 'Job not found' });
        }

        // ── applied candidate IDs for this job ───────────
        let appliedCandidateIds = [];
        try {
            if (CandidateATS) {
                appliedCandidateIds = await CandidateATS
                    .find({ client, job: id, isArchived: { $ne: true } })
                    .distinct('candidate')
                    .exec();
            }
        } catch (e) {
            fastify.log.error('[relevant-candidates] failed to load applied candidates', e);
            appliedCandidateIds = [];
        }
        const appliedSet = new Set(appliedCandidateIds.map(x => String(x)));

        fastify.log.info(
            '[relevant-candidates] appliedCandidateIds:',
            [...appliedSet]
        );

        // 2️⃣ First try: fetch from RelevancyRecord collection
        let rowsFromRelevancy = [];
        if (RelevancyRecord) {
            const records = await RelevancyRecord.find({
                client,
                job: id,
                isArchived: false
            })
                .populate({ path: 'candidate', select: 'firstName lastName email phoneNumber isArchived' })
                .lean()
                .exec();

            fastify.log.info(
                '[relevant-candidates] RelevancyRecord count:',
                records.length
            );

            rowsFromRelevancy = (records || [])
                .filter(r =>
                    r.candidate &&
                    !r.candidate.isArchived &&
                    (includeApplied || !appliedSet.has(String(r.candidate._id)))
                )
                .map(r => {
                    const baseScore = typeof r.candidateRelevancyToJob === 'number'
                        ? r.candidateRelevancyToJob
                        : null;

                    return {
                        id: String(r.candidate._id),
                        firstName: r.candidate.firstName || '',
                        lastName: r.candidate.lastName || '',
                        email: r.candidate.email || '',
                        phoneNumber: r.candidate.phoneNumber || '',
                        candidateRelevancyToJob: baseScore,
                        experienceRelevancy: r.experienceRelevancy ?? 0,
                        skillsRelevancy: r.skillsRelevancy ?? 0,
                        responsibilitiesRelevancy: r.responsibilitiesRelevancy ?? 0,
                        designationRelevancy: r.designationRelevancy ?? 0,
                        salaryRelevancy: r.salaryRelevancy ?? 0,
                        noticePeriodRelevancy: r.noticePeriodRelevancy ?? 0,
                        interestRelevancy: r.interestRelevancy ?? 0,
                        communicationRelevancy: r.communicationRelevancy ?? 0,
                        reason: r.reason || ''
                    };
                })
                .sort((a, b) =>
                    (b.candidateRelevancyToJob || 0) - (a.candidateRelevancyToJob || 0)
                );

            fastify.log.info(
                '[relevant-candidates] rowsFromRelevancy after filter:',
                rowsFromRelevancy.length
            );
        }

        if (rowsFromRelevancy.length > 0) {
            fastify.log.info(
                '[relevant-candidates] returning rows from RelevancyRecord:',
                rowsFromRelevancy.length
            );
            const transformedRows = rowsFromRelevancy.slice(0, 100).map(transformRelevancyForDisplay);
            return reply.send(transformedRows);
        }

        // 3️⃣ Fallback: no RelevancyRecord yet. Compute now using RelevancyService + upsert.
        fastify.log.warn(
            '[relevant-candidates] no RelevancyRecord found, computing on the fly'
        );

        const svcRel = new RelevancyService();

        const candidateFilter = {
            client,
            isArchived: false
        };

        if (!includeApplied && appliedCandidateIds.length) {
            candidateFilter._id = { $nin: appliedCandidateIds };
        }

        const candidates = await Candidate.find(candidateFilter).lean().exec();
        fastify.log.info(
            '[relevant-candidates] fallback candidates count:',
            candidates.length
        );

        const computedRows = [];
        for (const c of candidates) {
            const scores = await svcRel.computeRelevancyWithAI(c, job, { conn, client, user });
            await svcRel.upsertRelevancyRecord({
                client,
                candidateId: c._id,
                jobId: job._id,
                scores,
                conn
            });

            fastify.log.info(
                '[relevant-candidates] computed score for candidate',
                {
                    candidateId: String(c._id),
                    candidateRelevancyToJob: scores.candidateRelevancyToJob
                }
            );

            if ((scores.candidateRelevancyToJob || 0) >= 50) {
                computedRows.push({
                    id: String(c._id),
                    firstName: c.firstName || '',
                    lastName: c.lastName || '',
                    email: c.email || '',
                    phoneNumber: c.phoneNumber || '',
                    candidateRelevancyToJob: scores.candidateRelevancyToJob || 0,
                    experienceRelevancy: scores.experienceRelevancy || 0,
                    skillsRelevancy: scores.skillsRelevancy || 0,
                    responsibilitiesRelevancy: scores.responsibilitiesRelevancy || 0,
                    designationRelevancy: scores.designationRelevancy || 0,
                    salaryRelevancy: scores.salaryRelevancy || 0,
                    noticePeriodRelevancy: scores.noticePeriodRelevancy || 0,
                    interestRelevancy: scores.interestRelevancy || 0,
                    communicationRelevancy: scores.communicationRelevancy || 0,
                    reason: scores.reason || ''
                });
            }
        }

        computedRows.sort(
            (a, b) => (b.candidateRelevancyToJob || 0) - (a.candidateRelevancyToJob || 0)
        );

        fastify.log.info(
            '[relevant-candidates] returning computed rows:',
            computedRows.length
        );
        const transformedRows = computedRows.slice(0, 100).map(transformRelevancyForDisplay);
        return reply.send(transformedRows);
    });
}
