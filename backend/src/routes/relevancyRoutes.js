// backend/src/routes/relevancyRoutes.js
// import mongoose from 'mongoose';
import RelevancyService from '../services/relevancyService.js';

/**
 * Transform relevancy response for display:
 * Show "N/A" for fields not applicable to resume-only stage
 */
function transformRelevancyForDisplay(relevancy) {
    if (!relevancy) return relevancy;

    const result = { ...relevancy };

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


export default async function relevancyRoutes(fastify) {
    const svc = new RelevancyService();

    fastify.addHook('preHandler', fastify.authenticate);

    // LIST
    fastify.get('/', async (req, reply) => {
        const res = await svc.listRelevancy(
            req.query || {},
            req.user,
            req.client,
            req.conn
        );
        const items = (res?.items || []).map(transformRelevancyForDisplay);
        return reply.code(res?.code || 200).send(items);
    });

    // READ
    fastify.get('/:id', async (req, reply) => {
        const res = await svc.getRelevancyDetails(
            { id: req.params.id, ...(req.query || {}) },
            req.user,
            req.client,
            req.conn
        );
        const relevancy = res?.details?.relevancy || res;
        const transformed = transformRelevancyForDisplay(relevancy);
        return reply
            .code(res?.code || 200)
            .send({ ...transformed, _id: req.params.id });
    });

    // CREATE
    fastify.post('/', async (req, reply) => {
        const res = await svc.createRelevancy(
            req.body || {},
            req.user,
            req.client,
            req.conn
        );
        const relevancy = res?.details?.relevancy || res;
        const transformed = transformRelevancyForDisplay(relevancy);
        return reply.code(res?.code || 201).send(transformed);
    });

    // UPDATE
    fastify.put('/:id', async (req, reply) => {
        const res = await svc.updateRelevancy(
            { id: req.params.id, ...(req.body || {}) },
            req.user,
            req.client,
            req.conn
        );
        return reply.code(res?.code || 200).send(res?.details?.updated || res);
    });

    // DELETE -> ARCHIVE
    fastify.delete('/:id', async (req, reply) => {
        const res = await svc.archiveRelevancy(
            { id: req.params.id },
            req.user,
            req.client,
            req.conn
        );
        if (!res?.ok) return reply.code(res?.code || 400).send({ error: res?.message });
        return reply.code(200).send({ success: true });
    });
}
