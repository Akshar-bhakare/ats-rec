import mongoose from 'mongoose';

import SettingService from '../services/settingService.js';
import { getClientDbConn, resolveDbNameByClientId } from '../utils/clientDbUtils.js';


export default async function settingRoutes(fastify) {
    const svc = new SettingService();

    fastify.addHook('preHandler', fastify.authenticate);


    fastify.post('/', async (req, reply) => {
        const {
            serviceType,
            serviceProvider,
            configurationName,
            description,
            isActive,
            isDefault,
            configurationDetails
        } = req.body;

        const missing = [];
        if (!serviceType) missing.push('serviceType');
        if (!serviceProvider) missing.push('serviceProvider');
        if (!configurationName) missing.push('configurationName');
        if (missing.length) {
            return reply.code(400).send({ error: `Missing required field(s): ${missing.join(', ')}` });
        }

        if (!Array.isArray(serviceType) || serviceType.length === 0) {
            return reply.code(400).send({ error: 'serviceType must be a non‑empty array of strings' });
        }

        const dup = await req.conn.models['Setting'].findOne({
            configurationName,
            client: req.client,
            isArchived: false
        }).lean();
        if (dup) {
            return reply.code(409).send({ error: `ConfigurationName "${configurationName}" already exists.` });
        }

        let setting;
        try {
            setting = await svc.create(
                {
                    serviceType, serviceProvider, configurationName, description,
                    isActive, isDefault, configurationDetails, client: req.client
                },
                req
            );
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid setting data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            throw err;
        }
        return reply.code(201).send(setting);

    });


    fastify.get('/', async (req, reply) => {
        const list = await svc.readAll(req);
        return reply.send(list);

    });

    fastify.get('/:id', async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid setting ID format' });
        }
        const setting = await svc.readById(id, req);
        if (!setting) return reply.code(404).send({ error: 'Setting not found' });
        return reply.send(setting);

    });


    fastify.put('/:id', async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid setting ID format' });
        }

        if (req.body.configurationName) {
            const dup = await req.conn.models['Setting'].findOne({
                _id: { $ne: id },
                configurationName: req.body.configurationName,
                client: req.client,
                isArchived: false
            }).lean();
            if (dup) {
                return reply.code(409).send({
                    error: `ConfigurationName "${req.body.configurationName}" already exists.`
                });
            }
        }

        let updated;
        try {
            updated = await svc.update(id, req.body, req);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid setting data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            throw err;
        }

        if (!updated) {
            updated = await req.conn.models['Setting'].findByIdAndUpdate(id, req.body, { new: true }).exec();
        }
        if (!updated) return reply.code(404).send({ error: 'Setting not found' });
        return reply.send(updated);

    });


    fastify.delete('/:id', async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid setting ID format' });
        }

        const existing = await svc.readById(id, req);
        if (!existing) return reply.code(404).send({ error: 'Setting not found' });

        await svc.delete(id, req);
        return reply.code(204).send();

    });


    /* ---------- list or create settings for a single client ---------- */
    fastify
        .route({
            method: ['GET', 'POST'],
            url: '/client/:clientId',
            handler: async (req, reply) => {
                const { clientId } = req.params;

                /* connect to that client's DB */
                const dbName = await resolveDbNameByClientId(clientId);
                if (!dbName) return reply.code(404).send({ error: 'Client not found' });
                const cliConn = await getClientDbConn(dbName);

                /* list */
                if (req.method === 'GET') {
                    const rows = await cliConn.models['Setting']
                        .find({ isArchived: false })
                        .lean().exec();
                    return reply.send(rows);
                }

                /* create */
                if (req.method === 'POST') {
                    const payload = { ...req.body, client: clientId };
                    const created = await cliConn.models['Setting'].create(payload);
                    return reply.code(201).send(created);

                }
            }
        });

    /* ---------- update (or upsert) one client setting ---------- */
    fastify.put('/client/:clientId/:id', async (req, reply) => {        // 🆕
        const { clientId, id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return reply.code(400).send({ error: 'Invalid setting ID' });

        const dbName = await resolveDbNameByClientId(clientId);
        if (!dbName) return reply.code(404).send({ error: 'Client not found' });
        const cliConn = await getClientDbConn(dbName);

        const updated = await cliConn.models['Setting']
            .findOneAndUpdate(
                { _id: id, client: clientId },
                req.body,
                { new: true, upsert: false }
            )
            .lean().exec();

        if (!updated) return reply.code(404).send({ error: 'Setting not found' });
        return reply.send(updated);

    });

    /* ---------- archive one client setting ---------- */
    fastify.delete('/client/:clientId/:id', async (req, reply) => {
        const { clientId, id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return reply.code(400).send({ error: 'Invalid setting ID' });

        const dbName = await resolveDbNameByClientId(clientId);
        if (!dbName) return reply.code(404).send({ error: 'Client not found' });
        const cliConn = await getClientDbConn(dbName);

        const archived = await cliConn.models['Setting']
            .findOneAndUpdate(
                { _id: id, client: clientId, isArchived: false },
                { $set: { isArchived: true } },
                { new: true }
            )
            .lean()
            .exec();

        if (!archived) return reply.code(404).send({ error: 'Setting not found' });
        return reply.code(204).send();
    });

}
