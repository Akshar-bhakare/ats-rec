import mongoose from 'mongoose';
import RecruiterService from '../services/recruiterService.js';
import CRUDService from '../services/crudBase.js';
import { getNewAccountMailMsg, sendEmail } from '../services/eMailing/emailService.js';
import { validatePasswordStrength } from '../utils/passwordValidation.js';



export default async function recruiterRoutes(fastify) {
    const svc = new RecruiterService();
    const userSvc = new CRUDService('User');

    fastify.addHook('preHandler', fastify.authenticate);

    fastify.post('/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { accessRestrictions } = req.body;
        const { role, ...rest } = req.body;
        const requestedRole = String(role || '').trim().toLowerCase();
        const actorRole = String(req.user?.originalRole || req.user?.role || '').trim().toLowerCase();

        // ---------- validation ----------
        const missing = [];
        ['email', 'password', 'firstName', 'lastName', 'role'].forEach(f => {
            if (!req.body[f]) missing.push(f);
        });
        if (!accessRestrictions) {
            missing.push('accessRestrictions');
        } else {
            ['company', 'job', 'profile'].forEach(k => {
                if (accessRestrictions[k] == null) missing.push(`accessRestrictions.${k}`);
            });
        }
        if (missing.length) {
            return reply.code(400).send({ error: `Missing field(s): ${missing.join(', ')}` });
        }
        if (!['recruiter', 'manager'].includes(requestedRole)) {
            return reply.code(400).send({ error: 'role must be either recruiter or manager.' });
        }
        if (requestedRole === 'manager' && actorRole === 'manager') {
            return reply.code(403).send({
                ok: false,
                code: 403,
                message: 'Managers are not allowed to create another manager.'
            });
        }
        const pwCheck = validatePasswordStrength(req.body.password);
        if (!pwCheck.valid) {
            return reply.code(400).send({ error: pwCheck.message });
        }
        if (await req.conn.models.User.exists({ email: req.body.email.toLowerCase() })) {
            return reply.code(409).send({ error: 'A user with that email already exists.' });
        }
        let user;
        try {
            user = await userSvc.create({ ...rest, role: requestedRole }, req);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid user data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            throw err;
        }

        let populated;
        try {
            const record = await svc.create({ user: user._id, accessRestrictions }, req);
            populated = await req.conn.models.Recruiter
                .findById(record._id)
                .populate('user')
                .lean();
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({ error: 'Invalid data', details: Object.values(err.errors).map(e => e.message) });
            }
            throw err;
        }


        try {
            const mailTemplate = await getNewAccountMailMsg({
                name: `${req?.body?.firstName} ${req?.body?.lastName}`,
                role: requestedRole,
                email: req?.body?.email,
                password: req?.body?.password,
                reqContext: req,
            });
            await sendEmail({
                to: req?.body?.email?.toLowerCase?.(),
                subject: mailTemplate?.subject || "Welcome to Hirex REC",
                html: mailTemplate?.html,
                text: mailTemplate?.text,
                reqContext: req,
            });
        } catch (err) {
            console.log(
                "Error in sending e-mail notification: ", err
            );

            return reply.code(400).send({
                error: "Client Admin Created but, error in sending e-mail notification " + err?.message || "...",
            })
        }


        return reply.code(201).send(populated);
    });


    fastify.get('/', async (req, reply) => {
        try {
            const list = await req.conn.models.Recruiter
                .find({ isArchived: false })
                .populate('user')
                .lean();
            return reply.send(list);
        } catch (err) {
            return reply.code(400).send({ error: 'Failed to fetch recruiters' });
        }
    });


    fastify.get('/:recruiterUserId', async (req, reply) => {
        const { recruiterUserId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(recruiterUserId)) {
            return reply.code(400).send({ error: 'Invalid recruiter user ID format' });
        }
        try {
            const record = await req.conn.models.Recruiter
                .findOne({ user: recruiterUserId })
                .populate('user')
                .lean();
            if (!record) return reply.code(404).send({ error: 'Recruiter not found' });
            return reply.send(record);
        } catch (err) {
            return reply.code(400).send({ error: 'Failed to fetch recruiter' });
        }
    });


    fastify.put('/:recruiterUserId', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { recruiterUserId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(recruiterUserId))
            return reply.code(400).send({ error: 'Invalid recruiter user ID format' });

        const recDoc = await req.conn.models.Recruiter.findOne({ user: recruiterUserId });
        if (!recDoc) return reply.code(404).send({ error: 'Recruiter not found' });

        const ar = req.body.accessRestrictions ?? {};
        const fullAR = {
            company: ar.company !== undefined ? !!ar.company : recDoc.accessRestrictions.company,
            job: ar.job !== undefined ? !!ar.job : recDoc.accessRestrictions.job,
            profile: ar.profile !== undefined ? !!ar.profile : recDoc.accessRestrictions.profile,
        };

        const userSet = {};
        ['firstName', 'lastName', 'email', 'phoneNumber', 'countryCode', 'password'].forEach(f => {
            if (req.body[f]) userSet[f] = req.body[f];
        });

        if (userSet.password) {
            const pwCheck = validatePasswordStrength(userSet.password);
            if (!pwCheck.valid) {
                return reply.code(400).send({ error: pwCheck.message });
            }
        }

        try {
            await req.conn.models.Recruiter.findByIdAndUpdate(
                recDoc._id,
                { $set: { accessRestrictions: fullAR } },
                { new: true, runValidators: true }
            );

            if (Object.keys(userSet).length) {
                let recUsr = await req.conn.models.User.findById(recruiterUserId);
                recUsr.set(userSet);
                await recUsr.save();
            }

            const populated = await req.conn.models.Recruiter
                .findById(recDoc._id)
                .populate('user')
                .lean();

            return reply.send(populated);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({ error: 'Invalid data', details: Object.values(err.errors).map(e => e.message) });
            }
            throw err;
        }
    });


    fastify.delete('/:recruiterUserId', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { recruiterUserId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(recruiterUserId))
            return reply.code(400).send({ error: 'Invalid recruiter user ID format' });

        const recDoc = await req.conn.models.Recruiter.findOne({ user: recruiterUserId });
        if (!recDoc) return reply.code(404).send({ error: 'Recruiter not found' });

        await svc.delete(recDoc._id, req);
        recDoc?.user && await userSvc.delete(recDoc.user, req)
        return reply.code(204).send();
    });
}
