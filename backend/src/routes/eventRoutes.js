// backend/src/routes/eventRoutes.js
import EventService from '../services/eventService.js';

export default async function eventRoutes(fastify) {
    const svc = new EventService();

    fastify.addHook('preHandler', fastify.authenticate);

    // List all raw Events (you’ll see only timestamps + eventName)
    fastify.get('/', async (_, reply) => {
        const raw = await svc.eventSvc.readAll();
        return reply.send(raw);
    });

    // Optionally populate the eventName:
    fastify.get('/detailed', async (_, reply) => {
        const all = await svc.eventSvc.ModelName
            .find()
            .sort('-createdAt')
            .populate('eventName', 'userId eventName')
            .exec();
        return reply.send(all);
    });
}
