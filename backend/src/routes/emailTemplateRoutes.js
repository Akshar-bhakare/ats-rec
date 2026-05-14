import {
    EMAIL_TEMPLATE_DEFINITIONS,
    getMergedEmailTemplatesForClient,
    isValidEmailTemplateKey,
    resetEmailTemplateOverrideForClient,
    saveEmailTemplateOverrideForClient
} from '../services/eMailing/emailService.js';

const MAX_TEMPLATE_SUBJECT = 400;
const MAX_TEMPLATE_HTML = 200000;
const MAX_TEMPLATE_TEXT = 200000;

const canManageTemplates = (role) => ['client_admin', 'ultra_admin'].includes(String(role || '').trim());

const normalizeTemplatePayload = (body = {}) => ({
    subject: String(body?.subject || '').trim(),
    html: String(body?.html || '').trim(),
    text: String(body?.text || '').trim()
});

const validateTemplatePayload = ({ subject, html, text }) => {
    const errors = [];
    if (!subject) errors.push('subject is required');
    if (!html) errors.push('html is required');
    if (!text) errors.push('text is required');
    if (subject.length > MAX_TEMPLATE_SUBJECT) {
        errors.push(`subject exceeds ${MAX_TEMPLATE_SUBJECT} characters`);
    }
    if (html.length > MAX_TEMPLATE_HTML) {
        errors.push(`html exceeds ${MAX_TEMPLATE_HTML} characters`);
    }
    if (text.length > MAX_TEMPLATE_TEXT) {
        errors.push(`text exceeds ${MAX_TEMPLATE_TEXT} characters`);
    }
    return errors;
};

export default async function emailTemplateRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/', async (req, reply) => {
        if (!canManageTemplates(req.user?.role)) {
            return reply.code(403).send({ error: 'Only client admin can access email templates' });
        }

        try {
            const templates = await getMergedEmailTemplatesForClient(req);
            req.log.info(
                { clientId: String(req.client || ''), templateCount: templates.length },
                '[EmailTemplate] Loaded templates'
            );
            return reply.code(200).send({
                templates,
                definitions: EMAIL_TEMPLATE_DEFINITIONS
            });
        } catch (err) {
            req.log.error(
                { err: err?.message || err, clientId: String(req.client || '') },
                '[EmailTemplate] Failed to load templates'
            );
            return reply.code(500).send({ error: 'Failed to load email templates' });
        }
    });

    fastify.put('/:templateKey', async (req, reply) => {
        if (!canManageTemplates(req.user?.role)) {
            return reply.code(403).send({ error: 'Only client admin can update email templates' });
        }

        const { templateKey } = req.params || {};
        if (!isValidEmailTemplateKey(templateKey)) {
            return reply.code(400).send({ error: 'Invalid template key' });
        }

        const payload = normalizeTemplatePayload(req.body);
        const validationErrors = validateTemplatePayload(payload);
        if (validationErrors.length) {
            return reply.code(400).send({ error: 'Invalid template payload', details: validationErrors });
        }

        try {
            await saveEmailTemplateOverrideForClient(req, templateKey, payload);
            const templates = await getMergedEmailTemplatesForClient(req);
            const template = templates.find((item) => item.key === templateKey) || null;
            req.log.info(
                { clientId: String(req.client || ''), templateKey },
                '[EmailTemplate] Template updated'
            );
            return reply.code(200).send({ ok: true, template });
        } catch (err) {
            req.log.error(
                { err: err?.stack || err?.message || err, clientId: String(req.client || ''), templateKey },
                '[EmailTemplate] Failed to update template'
            );
            return reply.code(500).send({
                error: 'Failed to update email template',
                details: err?.message || String(err)
            });
        }
    });

    fastify.delete('/:templateKey', async (req, reply) => {
        if (!canManageTemplates(req.user?.role)) {
            return reply.code(403).send({ error: 'Only client admin can update email templates' });
        }

        const { templateKey } = req.params || {};
        if (!isValidEmailTemplateKey(templateKey)) {
            return reply.code(400).send({ error: 'Invalid template key' });
        }

        try {
            await resetEmailTemplateOverrideForClient(req, templateKey);
            const templates = await getMergedEmailTemplatesForClient(req);
            const template = templates.find((item) => item.key === templateKey) || null;
            req.log.info(
                { clientId: String(req.client || ''), templateKey },
                '[EmailTemplate] Template reset to default'
            );
            return reply.code(200).send({ ok: true, template });
        } catch (err) {
            req.log.error(
                { err: err?.stack || err?.message || err, clientId: String(req.client || ''), templateKey },
                '[EmailTemplate] Failed to reset template'
            );
            return reply.code(500).send({
                error: 'Failed to reset email template',
                details: err?.message || String(err)
            });
        }
    });
}