import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    mergeNotificationPreferences
} from '../utils/notificationPreferences.js';

const mergeWithExisting = (existing, incoming) => {
    const base = mergeNotificationPreferences(existing);
    return mergeNotificationPreferences({
        channels: { ...base.channels, ...(incoming?.channels || {}) },
        hiringActivity: { ...base.hiringActivity, ...(incoming?.hiringActivity || {}) },
        systemAccount: { ...base.systemAccount, ...(incoming?.systemAccount || {}) }
    });
};

export default async function notificationPreferenceRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/', async (req, reply) => {
        const Model = req.conn.models['NotificationPreference'];
        if (!Model) {
            return reply.code(500).send({ error: 'Notification preferences model unavailable' });
        }

        let doc = await Model.findOne({ client: req.client }).lean().exec();
        if (!doc) {
            const created = await Model.create({ client: req.client, ...DEFAULT_NOTIFICATION_PREFERENCES });
            doc = created?.toObject ? created.toObject() : created;
        }

        return reply.code(200).send(mergeNotificationPreferences(doc));
    });

    fastify.put('/', async (req, reply) => {
        if (req.user?.role !== 'client_admin') {
            return reply.code(403).send({ error: 'Only client admin can update notification settings' });
        }

        const Model = req.conn.models['NotificationPreference'];
        if (!Model) {
            return reply.code(500).send({ error: 'Notification preferences model unavailable' });
        }

        const incoming = req.body || {};
        const existing = await Model.findOne({ client: req.client }).lean().exec();
        const merged = mergeWithExisting(existing, incoming);

        const updated = await Model.findOneAndUpdate(
            { client: req.client },
            { $set: merged, $setOnInsert: { client: req.client } },
            { new: true, upsert: true }
        ).lean().exec();

        return reply.code(200).send(mergeNotificationPreferences(updated));
    });
}
