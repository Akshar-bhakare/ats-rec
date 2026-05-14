// backend/src/routes/emailRoutes.js
import GmailProvider from '../services/eMailing/providers/gmailProvider.js';
import mongoose from 'mongoose';

export default async function emailRoutes(fastify) {
    const gmail = new GmailProvider();
    fastify.addHook('preHandler', fastify.authenticate);

    const extractEmailAddress = (raw = '') => {
        const text = String(raw || '').trim();
        if (!text) return '';
        const angled = text.match(/<([^>]+)>/);
        const candidate = (angled?.[1] || text).trim().toLowerCase();
        const basicEmailMatch = candidate.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
        return basicEmailMatch ? basicEmailMatch[0].toLowerCase() : '';
    };

    const filterByCurrentClientCandidates = async (req, list = []) => {
        const items = Array.isArray(list) ? list : [];
        if (!items.length) return [];

        const Candidate = req?.conn?.models?.Candidate;
        if (!Candidate) return [];

        const fromEmails = Array.from(
            new Set(
                items
                    .map((item) => extractEmailAddress(item?.from))
                    .filter(Boolean)
            )
        );
        if (!fromEmails.length) return [];

        const existing = await Candidate.find({
            client: req.client,
            isArchived: false,
            email: { $in: fromEmails },
        })
            .select('email')
            .lean()
            .exec();

        const allowedEmailSet = new Set(
            (existing || [])
                .map((row) => String(row?.email || '').trim().toLowerCase())
                .filter(Boolean)
        );

        return items.filter((item) => {
            const sender = extractEmailAddress(item?.from);
            return sender && allowedEmailSet.has(sender);
        });
    };

    // GET /api/emails/unread -> list unread emails
    fastify.get('/unread', async (req, reply) => {
        try {
            const list = await gmail.getUnread();
            const scoped = await filterByCurrentClientCandidates(req, list);
            return reply.code(200).send(scoped);
        } catch (e) {
            fastify.log.error('emails/unread failed', e?.message || e);
            return reply.code(500).send([]);
        }
    });

    // GET /api/emails/replies -> unread replies only
    fastify.get('/replies', async (req, reply) => {
        try {
            const list = await gmail.getUnreadReplies();
            const scoped = await filterByCurrentClientCandidates(req, list);
            return reply.code(200).send(scoped);
        } catch (e) {
            fastify.log.error('emails/replies failed', e?.message || e);
            return reply.code(500).send([]);
        }
    });

    // GET /api/emails/:id -> full message detail
    fastify.get('/:id', async (req, reply) => {
        try {
            const id = String(req?.params?.id || '').trim();
            if (!id) return reply.code(400).send({ error: 'Invalid email id' });

            const one = await gmail.getMessage(id);
            if (!one) return reply.code(404).send({ error: 'Email not found' });

            const scoped = await filterByCurrentClientCandidates(req, [one]);
            if (!scoped.length) return reply.code(404).send({ error: 'Email not found' });

            return reply.code(200).send(scoped[0]);
        } catch (e) {
            fastify.log.error('emails/:id failed', e?.message || e);
            if (Number(e?.code) === 404) return reply.code(404).send({ error: 'Email not found' });
            return reply.code(500).send({ error: 'Failed to fetch email' });
        }
    });

    // POST /api/emails/ingest-replies -> upsert Notifications for unread replies
    // Idempotent de-dupe by meta.gmailId. Does NOT rely on user being a valid ObjectId.
    fastify.post('/ingest-replies', async (req, reply) => {
        try {
            const rawReplies = await gmail.getUnreadReplies();
            const list = await filterByCurrentClientCandidates(req, rawReplies);

            const Notification = req.conn.models['Notification'];

            const rawUserId = req?.user?._id || req?.user?.sub || null;
            const userId =
                rawUserId && mongoose.Types.ObjectId.isValid(String(rawUserId))
                    ? new mongoose.Types.ObjectId(String(rawUserId))
                    : null;

            const ops = [];
            for (const m of list) {
                const when = m.date ? new Date(m.date) : new Date();

                // filter: client + gmailId; include user only if valid to avoid CastErrors
                const filter = {
                    client: req.client,
                    'meta.gmailId': m.id,
                };
                if (userId) filter.user = userId;

                // only schema-safe fields at top level; stash the rest under meta
                const setOnInsert = {
                    client: req.client,
                    category: 'Email',
                    source: 'Gmail',
                    occurredAt: when,
                    isRead: false,
                    isArchived: false,
                    href: `/notifications/gmail_${m.id}/`,
                };
                if (userId) setOnInsert.user = userId;

                const set = {
                    content: `${m.from || 'Someone'} replied: ${m.subject || '(no subject)'}`,
                    subject: m.subject || '',
                    from: m.from || '',
                    to: m.to || '',
                    snippet: m.snippet || '',
                    meta: {
                        gmailId: m.id,
                        threadId: m.threadId || null,
                        messageId: m.messageId || null,
                        from: m.from || '',
                        subject: m.subject || '',
                        snippet: m.snippet || '',
                        date: m.date || '',
                    },
                };

                ops.push({
                    updateOne: {
                        filter,
                        update: { $setOnInsert: setOnInsert, $set: set },
                        upsert: true,
                    },
                });
            }

            if (ops.length) {
                await Notification.bulkWrite(ops, { ordered: false });
            }

            return reply.code(200).send({ ok: true, count: ops.length });
        } catch (e) {
            fastify.log.error('emails/ingest-replies failed', e?.message || e);
            return reply.code(500).send({ ok: false, message: 'ingest failed' });
        }
    });
}
