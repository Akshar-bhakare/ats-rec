import mongoose from 'mongoose';
import CRUDService from '../services/crudBase.js';
import { uploadBufferToFirebase, getDownloadURL } from '../utils/firebaseUtils.js';
import { requirePermission } from '../utils/permissionUtils.js';
import { validatePasswordStrength } from '../utils/passwordValidation.js';
import { getNewAccountMailMsg, sendEmail } from '../services/eMailing/emailService.js';

export default async function userRoutes(fastify) {
    const svc = new CRUDService('User');

    fastify.addHook('preHandler', fastify.authenticate);

    // LIST all users (supports optional role filter)
    fastify.get('/', async (req, reply) => {
        const role = typeof req?.query?.role === 'string' ? req.query.role.trim() : '';
        const baseFilter = { client: req.client, isArchived: false, ...(role ? { role } : {}) };

        // Populate events when needed (for Created By computation or view filtering)
        const needEvents = ('getEvents' in req.query) || ('viewMode' in req.query) || ('includeCreatedBy' in req.query);
        const listWithEvents = await svc.readAll(
            { ...req, query: baseFilter },
            needEvents,
            { name: 'Created' },
            true
        );

        const nameFromUser = (u) =>
            u ? ((`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()) || u.email || '—') : '—';

        let list = listWithEvents;

        // viewMode filter: 'me' => only items created by current user
        if (req?.query?.viewMode === 'me') {
            const me = `${req.user._id}`;
            list = listWithEvents.filter(u =>
                (u?.eventIds || []).some(ev =>
                    ev?.eventName?.name === 'Created' &&
                    ev?.eventName?.userId &&
                    `${ev.eventName.userId?._id || ev.eventName.userId}` === me
                )
            );
        }

        // Compute Created By name
        if (needEvents) {
            list = list.map(u => {
                const createdEv = (u.eventIds || []).find(e => e?.eventName?.name === 'Created');
                const creator = createdEv?.eventName?.userId;
                const createdByName = nameFromUser(creator);
                return { ...u, createdByName };
            });
        }

        // If using viewMode toggle or not explicitly requesting events, strip event arrays from payload
        if (('viewMode' in req.query) && !('getEvents' in req.query)) {
            list = list.map(u => {
                const { eventIds, ...rest } = u;
                return { ...rest };
            });
        }

        return reply.send(list);
    });

    // READ one user
    fastify.get('/:id', async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid user ID format' });
        }
        const user = await svc.readById(id, req);
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }
        return reply.send(user);
    });


    // CREATE new user
    fastify.post('/', async (req, reply) => {
        const { role, clientId, ...rest } = req.body;
        const missing = [];
        ['email', 'password', 'firstName', 'lastName', 'role'].forEach(f => {
            if (!req.body[f]) missing.push(f);
        });
        if (missing.length) {
            return reply
                .code(400)
                .send({ error: `Missing required field(s): ${missing.join(', ')}` });
        }
        const pwCheck = validatePasswordStrength(req.body.password);
        if (!pwCheck.valid) {
            return reply.code(400).send({ error: pwCheck.message });
        }
        if (await req.conn.models['User'].exists({ email: req.body.email.toLowerCase() })) {
            return reply
                .code(409)
                .send({ error: 'A user with that email already exists.' });
        }
        let user;
        try {
            user = await svc.create({ ...rest, role }, req);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid user data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            throw err;
        }

        // Send welcome email with login credentials
        try {
            const mailTemplate = await getNewAccountMailMsg({
                name: `${req.body.firstName} ${req.body.lastName}`.trim(),
                role,
                email: req.body.email,
                password: req.body.password,
                reqContext: req,
            });
            await sendEmail({
                to: req.body.email.toLowerCase(),
                subject: mailTemplate?.subject || 'Welcome to Hirex REC',
                html: mailTemplate?.html,
                text: mailTemplate?.text,
                reqContext: req,
            });
        } catch (emailErr) {
            console.warn('[UserRoutes] Failed to send welcome email to', req.body.email, emailErr?.message || emailErr);
        }

        return reply.code(201).send(user);
    });


    // UPDATE user (with Base64 image)
    fastify.put('/:id', { preHandler: [requirePermission('profile')] }, async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid user ID format' });
        }

        const { profileImageBase64, socialLinks, ...rest } = req.body;
        const payload = { ...rest, socialLinks };

        if (rest.password) {
            const pwCheck = validatePasswordStrength(rest.password);
            if (!pwCheck.valid) {
                return reply.code(400).send({ error: pwCheck.message });
            }
        }

        if (profileImageBase64) {
            const buffer = Buffer.from(profileImageBase64, 'base64');
            const remotePath = `profiles/${id}.jpg`;
            await uploadBufferToFirebase(buffer, remotePath, 'image/jpeg');
            const url = await getDownloadURL(remotePath);
            payload.profileUrl = url;
        }

        let updated;
        try {
            updated = await svc.update(id, payload, req, true);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid user data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            throw err;
        }
        if (!updated) {
            return reply.code(404).send({ error: 'User not found' });
        }
        return reply.send(updated);
    });

    // DELETE user
    fastify.delete('/:id', async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid user ID format' });
        }
        const existing = await svc.readById(id, req);
        if (!existing) {
            return reply.code(404).send({ error: 'User not found' });
        }
        await svc.delete(id, req);
        return reply.code(204).send();
    });


    fastify.get('/archived', async (req, reply) => {
        const role = String(req.query?.role || '').trim();
        const filter = { isArchived: true, client: req.client, ...(role ? { role } : {}) };

        const populates = [];
        if ('getEvents' in req.query || 'viewMode' in req.query) {
            populates.push({
                path: 'eventIds',
                select: 'eventAt eventName',
                populate: {
                    path: 'eventName',
                    model: 'EventName',
                    select: 'name userId',
                    match: { name: 'Created' }
                }
            });
        }

        let list = await req.conn.models['User']
            .find(filter)
            .populate(populates)
            .lean()
            .exec();

        const nameFromUser = u =>
            u ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || '—') : '—';

        list = list.map(u => {
            const createdEv = (u.eventIds || []).find(e => e?.eventName?.name === 'Created');
            const creator = createdEv?.eventName?.userId;
            const createdBy = nameFromUser(creator);
            u.eventIds = [];
            return {
                ...u,
                id: u._id,
                createdBy,
                createdAt: u.createdAt?.toISOString?.().substring(0, 10) || ''
            };
        });

        return reply.send(list);
    });

    // ARCHIVE (soft delete)
    fastify.put('/:id/archive', async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid User ID format' });
        }
        const updated = await req.conn.models['User'].findOneAndUpdate(
            { _id: id, client: req.client },
            { $set: { isArchived: true } },
            { new: true }
        ).lean();
        if (!updated) return reply.code(404).send({ error: 'User not found' });
        return reply.send(updated);
    });

    // UNARCHIVE
    fastify.put('/:id/unarchive', async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid User ID format' });
        }
        const updated = await req.conn.models['User'].findOneAndUpdate(
            { _id: id, client: req.client },
            { $set: { isArchived: false } },
            { new: true }
        ).lean();
        if (!updated) return reply.code(404).send({ error: 'User not found' });
        return reply.send(updated);
    });

    // GET /interview-security-settings — get client's interview security feature flags
    fastify.get('/interview-security-settings', async (req, reply) => {
        try {
            const User = req.conn.models['User'];
            const clientUser = await User.findOne({ _id: req.client }).select('interviewSecuritySettings').lean().exec();
            const defaults = { faceDetectionEnabled: false, readingPassageEnabled: false };
            return reply.send({ ...defaults, ...(clientUser?.interviewSecuritySettings || {}) });
        } catch (err) {
            return reply.code(500).send({ error: 'Failed to load interview security settings' });
        }
    });

    // PUT /interview-security-settings — update client's interview security feature flags
    fastify.put('/interview-security-settings', async (req, reply) => {
        try {
            if (!['client_admin', 'ultra_admin'].includes(req.user?.role)) {
                return reply.code(403).send({ error: 'Not authorized' });
            }
            const { faceDetectionEnabled, readingPassageEnabled } = req.body || {};
            const User = req.conn.models['User'];
            const updated = await User.findOneAndUpdate(
                { _id: req.client },
                {
                    $set: {
                        'interviewSecuritySettings.faceDetectionEnabled': faceDetectionEnabled === true,
                        'interviewSecuritySettings.readingPassageEnabled': readingPassageEnabled === true,
                    }
                },
                { new: true }
            ).select('interviewSecuritySettings').lean().exec();
            return reply.send({ ...{ faceDetectionEnabled: false, readingPassageEnabled: false }, ...(updated?.interviewSecuritySettings || {}) });
        } catch (err) {
            return reply.code(500).send({ error: 'Failed to save interview security settings' });
        }
    });

}



