import NotificationService from '../services/notificationService.js';

export default async function notificationRoutes(fastify) {
    const svc = new NotificationService();
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.post('/', async (req, reply) => {
        const result = await svc.createNotification(req.body || {}, req);
        fastify.log.info(result.ok ? '✅ Notification stored successfully' : '❌ Failed to store notification');
        return reply.code(result.code).send(result.ok ? result.details.notification : { error: result.message });
    });

    fastify.post('/bulk', async (req, reply) => {
        const result = await svc.createManyNotifications(req.body || [], req);
        return reply.code(result.code).send(result.ok ? result.details : { error: result.message });
    });

    fastify.get('/', async (req, reply) => {
        const result = await svc.getNotifications(req.query || {}, req);
        return reply.code(result.code).send(result.ok ? result.items : { error: result.message });
    });

    fastify.get('/:id', async (req, reply) => {
        const result = await svc.getNotification(req.params.id, req);
        return reply.code(result.code).send(result.ok ? result.details.notification : { error: result.message });
    });

    fastify.put('/:id/read', async (req, reply) => {
        const { read = true } = req.body || {};
        const result = await svc.markRead(req.params.id, !!read, req);
        return reply.code(result.code).send(result.ok ? result.details.updated : { error: result.message });
    });

    fastify.put('/mark-all-read', async (req, reply) => {
        const result = await svc.markAllRead(req.body || {}, req);
        return reply.code(result.code).send(result.ok ? result.details : { error: result.message });
    });

    fastify.put('/:id/archive', async (req, reply) => {
        const result = await svc.archive(req.params.id, true, req);
        return reply.code(result.code).send(result.ok ? result.details.updated : { error: result.message });
    });

    fastify.put('/:id/unarchive', async (req, reply) => {
        const result = await svc.archive(req.params.id, false, req);
        return reply.code(result.code).send(result.ok ? result.details.updated : { error: result.message });
    });
}
