import mongoose from 'mongoose';
import StageService from '../services/stageService.js';
import CRUDService from '../services/crudBase.js';

export default async function stageRoutes(fastify) {
    const svc = new StageService();
    const svcStageResult = new CRUDService('StageResult');
    const svcCandidateATS = new CRUDService('CandidateATS');

    fastify.addHook('preHandler', fastify.authenticate);

    const escapeRegExp = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    fastify.post('/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(403)
                .send({ error: `Stage creation unavailable for this user...` });

        }
        const Stage = req.conn.models['Stage'];

        const rawTitle = req.body?.title;
        const title = (rawTitle || '').trim();
        const missing = [];
        if (!title) missing.push('title');
        if (missing.length) {
            return reply.code(400).send({
                error: `Missing required field(s): ${missing.join(', ')}`
            });
        }

        const dup = await Stage.findOne({
            client: req.client,
            title: { $regex: `^${escapeRegExp(title)}$`, $options: 'i' },
        }).lean();
        if (dup) {
            return reply
                .code(409)
                .send({ error: `Stage "${title}" already exists for this client.` });
        }

        let stage;
        try {
            stage = await svc.create({ ...req.body, title }, req);

            (async () => {
                try {
                    let allStages = [stage];

                    let allStageResultIds = [];

                    for (const newStage of allStages) {

                        let newStageResultDt = { stage: newStage._id, stageStatus: "Not Initiated", remarkOrFeedback: '', isArchived: false, client: req.client };

                        let newStageResult = await req.conn.models['StageResult'].findOne(newStageResultDt).lean().exec();
                        if (!newStageResult) {
                            newStageResult = await svcStageResult.create(newStageResultDt, req);
                        }

                        allStageResultIds.push(newStageResult._id);
                    }

                    let allCanATS = await req.conn.models['CandidateATS'].find().lean().exec();
                    for (const newCanATS of allCanATS) {
                        await svcCandidateATS.update(newCanATS._id, {
                            $addToSet: { stageResults: { $each: allStageResultIds } },
                        }, req);

                    }
                } catch (err) {
                    console.log(
                        "❌ Error in assigning stage to all candidate's ATS: ", err
                    );

                }
            })();

        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid stage data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            throw err;
        }
        return reply.code(201).send(stage);
    });

    fastify.get('/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(403)
                .send({ error: `Stage access unavailable for this user...` });

        }
        const stages = await svc.readAll(req);
        return reply.send(stages);

    });

    fastify.get('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(403)
                .send({ error: `Stage access unavailable for this user...` });

        }
        const Stage = req.conn.models['Stage'];
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid stage ID format' });
        }
        const stage = await svc.readById(id, req);
        if (!stage) {
            return reply.code(404).send({ error: 'Stage not found' });
        }
        return reply.send(stage);

    });

    fastify.put('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(403)
                .send({ error: `Stage update unavailable for this user...` });

        }
        const Stage = req.conn.models['Stage'];
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid stage ID format' });
        }

        if (req.body.title) {
            const newTitle = (req.body.title || '').trim();
            if (newTitle) {
                const dup = await Stage.findOne({
                    _id: { $ne: id },
                    client: req.client,
                    title: { $regex: `^${escapeRegExp(newTitle)}$`, $options: 'i' },
                }).lean();
                if (dup) {
                    return reply
                        .code(409)
                        .send({ error: `Stage "${newTitle}" already exists...` });
                }
            }
            req.body.title = newTitle;
        }

        let updated;
        try {
            updated = await svc.update(id, req.body, req);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid stage data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            throw err;
        }
        if (!updated) {
            return reply.code(404).send({ error: 'Stage not found' });
        }
        return reply.send(updated);

    });

    fastify.delete('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(403)
                .send({ error: `Stage deletion unavailable for this user...` });

        }
        const Stage = req.conn.models['Stage'];
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid stage ID format' });
        }
        const existing = await svc.readById(id, req);
        if (!existing) {
            return reply.code(404).send({ error: 'Stage not found' });
        }
        await svc.delete(id, req);
        return reply.code(204).send();

    });

    fastify.get('/archived', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(403)
                .send({ error: `Stage access unavailable for this user...` });
        }
        const Stage = req.conn.models['Stage'];
        const list = await Stage.find({ client: req.client, isArchived: true }).lean();
        return reply.send(list);
    });

    // ★ ADDED: Unarchive a stage
    fastify.put('/:id/unarchive', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(403)
                .send({ error: `Stage update unavailable for this user...` });
        }
        const Stage = req.conn.models['Stage'];
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid stage ID format' });
        }
        const existing = await Stage.findOne({ _id: id, client: req.client }).lean();
        if (!existing) return reply.code(404).send({ error: 'Stage not found' });

        await Stage.updateOne({ _id: id, client: req.client }, { $set: { isArchived: false } });
        const unarchived = await svc.readById(id, req);
        return reply.send(unarchived);
    });
}
