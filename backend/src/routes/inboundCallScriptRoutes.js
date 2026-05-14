/**
 * Inbound Call Script Routes
 * Prefix: /api/inbound-call-scripts
 *
 * GET  /          - get the active script for the current client
 * POST /          - create a new script (replaces any existing active one)
 * PUT  /:id       - update an existing script
 * DELETE /:id     - archive a script
 */

export default async function inboundCallScriptRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate);

    // ── GET / ─────────────────────────────────────────────────────────────────
    fastify.get('/', async (req, reply) => {
        const script = await req.conn.models.InboundCallScript
            .findOne({ client: req.client, isArchived: false })
            .lean()
            .exec();

        return reply.send(script || null);
    });

    // ── POST / ────────────────────────────────────────────────────────────────
    fastify.post('/', async (req, reply) => {
        const {
            name,
            greeting,
            jobQuestion,
            companyQuestion,
            basicQuestions = [],
            skillsPrompt,
            numbers = [],
        } = req.body;

        // Deactivate any existing active scripts for this client
        await req.conn.models.InboundCallScript.updateMany(
            { client: req.client, isArchived: false },
            { isArchived: true },
        );

        const script = await req.conn.models.InboundCallScript.create({
            client: req.client,
            name,
            greeting,
            jobQuestion,
            companyQuestion,
            basicQuestions: basicQuestions.filter((q) => q?.trim?.()),
            skillsPrompt,
            numbers,
            isActive: true,
        });

        return reply.code(201).send(script);
    });

    // ── PUT /:id ──────────────────────────────────────────────────────────────
    fastify.put('/:id', async (req, reply) => {
        const {
            name,
            greeting,
            jobQuestion,
            companyQuestion,
            basicQuestions,
            skillsPrompt,
            numbers,
        } = req.body;

        const update = {};
        if (name != null) update.name = name;
        if (greeting != null) update.greeting = greeting;
        if (jobQuestion != null) update.jobQuestion = jobQuestion;
        if (companyQuestion != null) update.companyQuestion = companyQuestion;
        if (basicQuestions != null) update.basicQuestions = basicQuestions.filter((q) => q?.trim?.());
        if (skillsPrompt != null) update.skillsPrompt = skillsPrompt;
        if (numbers != null) update.numbers = numbers;

        const script = await req.conn.models.InboundCallScript.findOneAndUpdate(
            { _id: req.params.id, client: req.client, isArchived: false },
            { $set: update },
            { new: true },
        ).lean().exec();

        if (!script) return reply.code(404).send({ error: 'Script not found' });
        return reply.send(script);
    });

    // ── DELETE /:id ───────────────────────────────────────────────────────────
    fastify.delete('/:id', async (req, reply) => {
        await req.conn.models.InboundCallScript.findOneAndUpdate(
            { _id: req.params.id, client: req.client },
            { $set: { isArchived: true } },
        );
        return reply.send({ ok: true });
    });
}