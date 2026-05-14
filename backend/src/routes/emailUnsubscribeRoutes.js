import {
    EMAIL_UNSUBSCRIBE_REASONS,
    maskEmailForDisplay,
    verifyEmailUnsubscribeToken,
} from '../utils/emailUnsubscribeUtils.js';
import { getClientDbConn } from '../utils/clientDbUtils.js';

const normalizeReason = (value) => {
    const reason = String(value || '').trim();
    if (!reason) return '';
    if (EMAIL_UNSUBSCRIBE_REASONS.includes(reason)) return reason;
    return reason.slice(0, 160);
};

const buildFilter = ({ email, clientId }) => {
    const filter = { email: String(email || '').trim().toLowerCase() };
    if (clientId) {
        filter.client = clientId;
    }
    return filter;
};

const summarizeState = (userDoc, candidateDoc) => {
    const userUnsubscribed = Boolean(userDoc?.emailUnsubscribed);
    const candidateUnsubscribed = Boolean(candidateDoc?.emailUnsubscribed);
    const reason = String(
        userDoc?.emailUnsubscribeReason ||
        candidateDoc?.emailUnsubscribeReason ||
        ''
    ).trim();

    return {
        found: Boolean(userDoc || candidateDoc),
        unsubscribed: userUnsubscribed || candidateUnsubscribed,
        reason,
    };
};

export default async function emailUnsubscribeRoutes(fastify) {
    fastify.get('/preview', { config: { csrf: false } }, async (req, reply) => {
        const token = String(req?.query?.token || '').trim();
        if (!token) {
            return reply.code(400).send({ error: 'Missing unsubscribe token' });
        }

        let payload;
        try {
            payload = verifyEmailUnsubscribeToken(token);
        } catch (err) {
            return reply.code(400).send({ error: err?.message || 'Invalid unsubscribe token' });
        }

        const conn = await getClientDbConn(payload.dbName);
        const User = conn.models.User;
        const Candidate = conn.models.Candidate;
        const filter = buildFilter(payload);

        const [userDoc, candidateDoc] = await Promise.all([
            User ? User.findOne(filter).select('emailUnsubscribed emailUnsubscribeReason').lean().exec() : null,
            Candidate ? Candidate.findOne(filter).select('emailUnsubscribed emailUnsubscribeReason').lean().exec() : null,
        ]);

        const state = summarizeState(userDoc, candidateDoc);

        return reply.code(200).send({
            ok: true,
            emailMasked: maskEmailForDisplay(payload.email),
            unsubscribed: state.unsubscribed,
            reason: state.reason,
            found: state.found,
            reasons: EMAIL_UNSUBSCRIBE_REASONS,
        });
    });

    fastify.post('/', { config: { csrf: false } }, async (req, reply) => {
        const token = String(req?.body?.token || '').trim();
        const reason = normalizeReason(req?.body?.reason);

        if (!token) {
            return reply.code(400).send({ error: 'Missing unsubscribe token' });
        }
        if (!reason) {
            return reply.code(400).send({ error: 'Please select an unsubscribe reason' });
        }

        let payload;
        try {
            payload = verifyEmailUnsubscribeToken(token);
        } catch (err) {
            return reply.code(400).send({ error: err?.message || 'Invalid unsubscribe token' });
        }

        const conn = await getClientDbConn(payload.dbName);
        const User = conn.models.User;
        const Candidate = conn.models.Candidate;
        const filter = buildFilter(payload);
        const update = {
            $set: {
                emailUnsubscribed: true,
                emailUnsubscribedAt: new Date(),
                emailUnsubscribeReason: reason,
                emailUnsubscribeSource: 'unsubscribe_link',
            },
        };

        const [userRes, candidateRes] = await Promise.all([
            User ? User.updateMany(filter, update).exec() : null,
            Candidate ? Candidate.updateMany(filter, update).exec() : null,
        ]);

        const userMatched = Number(userRes?.matchedCount || userRes?.n || 0);
        const candidateMatched = Number(candidateRes?.matchedCount || candidateRes?.n || 0);

        return reply.code(200).send({
            ok: true,
            unsubscribed: true,
            emailMasked: maskEmailForDisplay(payload.email),
            reason,
            matched: userMatched + candidateMatched,
        });
    });
}
