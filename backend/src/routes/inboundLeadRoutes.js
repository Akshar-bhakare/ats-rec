const parseBooleanQuery = (value) => {
    if (value == null) return null;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes'].includes(normalized)) return true;
    if (['0', 'false', 'no'].includes(normalized)) return false;
    return null;
};

export default async function inboundLeadRoutes(fastify) {

    fastify.addHook('preHandler', fastify.authenticate);

    // GET /api/inbound-leads/?page=1&pageSize=25
    fastify.get('/', async (req, reply) => {
        const all = parseBooleanQuery(req.query.all) === true;
        const requestedPage = Math.max(1, parseInt(req.query.page || '1', 10));
        const requestedPageSize = parseInt(req.query.pageSize || (all ? '1000' : '25'), 10);
        const page = all ? 1 : requestedPage;
        const pageSize = all
            ? Math.min(5000, Math.max(1, requestedPageSize))
            : Math.min(100, Math.max(1, requestedPageSize));
        const skip = all ? 0 : (page - 1) * pageSize;

        const filter = { client: req.client, isArchived: false };
        const countedTowardsCredits = parseBooleanQuery(req.query.countedTowardsCredits);
        if (countedTowardsCredits != null) {
            filter.countedTowardsCredits = countedTowardsCredits;
        }

        const itemsQuery = req.conn.models.InboundLead
            .find(filter)
            .sort({ callDate: -1 });

        if (!all) {
            itemsQuery.skip(skip).limit(pageSize);
        }

        const [items, total] = await Promise.all([
            itemsQuery.lean().exec(),
            req.conn.models.InboundLead.countDocuments(filter),
        ]);

        return reply.send({
            items,
            total,
            page,
            pageSize: all ? items.length : pageSize,
        });
    });

    // PATCH /api/inbound-leads/:id — update status
    fastify.patch('/:id', async (req, reply) => {
        const { status } = req.body;
        const updated = await req.conn.models.InboundLead.findOneAndUpdate(
            { _id: req.params.id, client: req.client, isArchived: false },
            { $set: { status } },
            { new: true },
        ).lean().exec();

        if (!updated) return reply.code(404).send({ error: 'Not found' });
        return reply.send(updated);
    });

    // DELETE /api/inbound-leads/:id — archive
    fastify.delete('/:id', async (req, reply) => {
        await req.conn.models.InboundLead.findOneAndUpdate(
            { _id: req.params.id, client: req.client },
            { $set: { isArchived: true } },
        );
        return reply.send({ ok: true });
    });
}
