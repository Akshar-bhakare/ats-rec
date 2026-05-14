import { updateCandidateFromConversation } from "../services/updateCandidateFromConversation.js";


export default async function conversationSummaryRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.post('/conversations/:id/summary', async (req, reply) => {
        try {
            const { summary, candidate } =
                await updateCandidateFromConversation(req.params.id, req);
            return reply.send({ success: true, summary, candidate });
        } catch (err) {
            return reply.code(400).send({ success: false, error: err.message });
        }
    });
}
