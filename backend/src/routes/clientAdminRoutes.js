// backend/src/routes/clientAdminRoutes.js
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import ClientAdminService from '../services/clientAdminService.js';
import CRUDService from '../services/crudBase.js';
import { getNewAccountMailMsg, sendEmail } from '../services/eMailing/emailService.js';
import { getClientDbConn } from '../utils/clientDbUtils.js';
import { validatePasswordStrength } from '../utils/passwordValidation.js';

export default async function clientAdminRoutes(fastify) {
    const svc = new ClientAdminService();
    const userSvc = new CRUDService('User');

    fastify.addHook('preHandler', fastify.authenticate);

    async function findClientAdminFlexible(clientId, connection, useLean = true) {
        if (!mongoose.Types.ObjectId.isValid(clientId)) return null;

        // Try by document _id
        let clientAdminById = connection.models.ClientAdmin.findById(clientId).populate('user');
        if (useLean) clientAdminById = clientAdminById.lean();
        const foundById = await clientAdminById.exec();
        if (foundById) return foundById;

        // Try by client field (user id)
        let clientAdminByClientField = connection.models.ClientAdmin.findOne({ client: clientId }).populate('user');
        if (useLean) clientAdminByClientField = clientAdminByClientField.lean();
        const foundByClientField = await clientAdminByClientField.exec();
        return foundByClientField || null;
    }

    fastify.post('/', async (req, reply) => {
        if (!['ultra_admin'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const {
            clientCompany,
            totalCredit = 10,
            creditRatePerCall = 1,
            videoInterviewCredit = 10
        } = req.body;
        const { role, clientId, ...rest } = req.body;

        const missing = [];
        ['email', 'password', 'firstName', 'lastName', 'role'].forEach(f => {
            if (!req.body[f]) missing.push(f);
        });
        if (!clientCompany) missing.push('clientCompany');
        if (totalCredit == null) missing.push('totalCredit');
        if (creditRatePerCall == null) missing.push('creditRatePerCall');
        if (videoInterviewCredit == null) missing.push('videoInterviewCredit');

        if (missing.length) {
            return reply
                .code(400)
                .send({ error: `Missing field(s): ${missing.join(', ')}` });
        }

        const pwCheck = validatePasswordStrength(req.body.password);
        if (!pwCheck.valid) {
            return reply.code(400).send({ error: pwCheck.message });
        }

        // Normalize numeric fields and validate BEFORE creating any documents
        const numericTotalCredit = Number(totalCredit);
        const numericCreditRatePerCall = Number(creditRatePerCall);
        const numericVideoInterviewCredit = Number(videoInterviewCredit);
        const validationDetails = [];

        if (Number.isNaN(numericTotalCredit) || numericTotalCredit < 0) {
            validationDetails.push('totalCredit must be ≥ 0');
        }
        if (Number.isNaN(numericCreditRatePerCall) || numericCreditRatePerCall < 0) {
            validationDetails.push('creditRatePerCall must be ≥ 0');
        }
        if (Number.isNaN(numericVideoInterviewCredit) || numericVideoInterviewCredit < 0) {
            validationDetails.push('videoInterviewCredit must be ≥ 0');
        }

        if (validationDetails.length) {
            return reply.code(400).send({
                error: 'Invalid data',
                details: validationDetails
            });
        }

        if (await req.conn.models['User'].exists({ email: req.body.email.toLowerCase() })) {
            return reply
                .code(409)
                .send({ error: 'A user with that email already exists.' });
        }

        if (await req.conn.models.ClientAdmin
            .exists({ clientCompany })
            .collation({ locale: 'en', strength: 2 })) {
            return reply.code(409)
                .send({ error: 'Company Name already taken for another client. Try other name...' });
        }

        let user;
        try {
            user = await userSvc.create({ ...rest, role }, req);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid user data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            console.log("❌ Invalid Client-Admin user data, cause: ", err);
            return reply.code(500).send({ error: 'Failed to create client-admin user' });
        }

        if (
            await req.conn.models.ClientAdmin.exists({ user }) ||
            (req.body?.aiSelektWaId &&
                await req.conn.models.ClientAdmin.exists({ aiSelektWaId: req.body?.aiSelektWaId }))
        ) {
            // Rollback created user if we detect an existing ClientAdmin conflict
            try {
                await req.conn.models.User.findByIdAndDelete(user._id);
            } catch (cleanupErr) {
                console.log('❌ Failed to rollback user after ClientAdmin exists check:', cleanupErr);
            }

            return reply.code(409)
                .send({ error: 'ClientAdmin already exists for this user and AiSelekt WhatsApp Number combination.' });
        }

        let record;
        try {
            record = await svc.create(
                {
                    ...(req.body || {}),
                    client: user._id,
                    user: user._id,
                    clientCompany,
                    totalCredit: numericTotalCredit,
                    creditRatePerCall: numericCreditRatePerCall,
                    videoInterviewCredit: numericVideoInterviewCredit
                },
                req
            );
        } catch (err) {
            // IMPORTANT: rollback the User if ClientAdmin creation fails
            if (user && user._id) {
                try {
                    await req.conn.models.User.findByIdAndDelete(user._id);
                } catch (cleanupErr) {
                    console.log('❌ Failed to rollback user after Client-Admin create error:', cleanupErr);
                }
            }

            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            console.log("❌ Invalid Client-Admin data, cause: ", err);
            return reply.code(500).send({ error: 'Failed to create client-admin' });
        }

        try {
            const mailTemplate = await getNewAccountMailMsg({
                name: `${req?.body?.firstName} ${req?.body?.lastName}`,
                role,
                email: req?.body?.email,
                password: req?.body?.password,
                reqContext: req,
            });
            await sendEmail({
                to: req?.body?.email?.toLowerCase(),
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
                error: "Client Admin Created but, error in sending e-mail notification " + (err?.message || "..."),
            });
        }

        return reply.code(201).send(record);
    });

    // LIST active client-admins
    fastify.get('/', async (req, reply) => {
        if (req.user.role !== 'ultra_admin') {
            return reply
                .code(403)
                .send({ error: `Client-Admin access unavailable for this user...` });
        }

        const list = await req.conn.models.ClientAdmin
            .find({ isArchived: false })
            .populate({ path: 'user' })
            .lean();
        return reply.send(list);
    });

    // GET single (flexible lookup)
    fastify.get('/:clientId', async (req, reply) => {
        if (req.user.role !== 'ultra_admin') {
            return reply
                .code(403)
                .send({ error: `Client-Admin access unavailable for this user...` });
        }

        const { clientId } = req.params;
        try {
            const foundClientAdmin = await findClientAdminFlexible(clientId, req.conn, true);
            if (!foundClientAdmin) return reply.code(404).send({ error: 'ClientAdmin not found' });
            return reply.send(foundClientAdmin);
        } catch (err) {
            console.log('❌ Error fetching client-admin:', err);
            return reply.code(500).send({ error: 'Failed to fetch client-admin' });
        }
    });

    // UPDATE
    fastify.put('/:clientId', async (req, reply) => {
        if (req.user.role !== 'ultra_admin') {
            return reply
                .code(403)
                .send({ error: `Client-Admin update unavailable for this user...` });
        }

        const { clientId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(clientId)) {
            return reply.code(400).send({ error: 'Invalid client ID format' });
        }

        let existingClient = await req.conn.models.ClientAdmin.findOne({ _id: clientId }).populate('user');
        if (!existingClient) {
            existingClient = await req.conn.models.ClientAdmin.findOne({ client: clientId }).populate('user');
        }

        if (!existingClient) {
            return reply.code(404).send({ error: 'ClientAdmin record not found...' });
        }

        const existingClientUser = await req.conn.models['User'].findOne({ _id: existingClient.user._id }).lean().exec();
        if (!existingClientUser) {
            return reply.code(404).send({ error: 'Client Admin User record not found...' });
        }

        const updateUserData = {};
        if (req?.body?.firstName && req.body.firstName != existingClientUser?.firstName) updateUserData.firstName = req.body.firstName;
        if (req?.body?.lastName && req.body.lastName != existingClientUser?.lastName) updateUserData.lastName = req.body.lastName;
        if (req?.body?.countryCode && req.body.countryCode != existingClientUser?.countryCode) updateUserData.countryCode = req.body.countryCode;
        if (req?.body?.phoneNumber && req.body.phoneNumber != existingClientUser?.phoneNumber) updateUserData.phoneNumber = req.body.phoneNumber;
        if (req?.body?.password && !(await bcrypt.compare(req.body.password, existingClientUser?.password))) {
            const pwCheck = validatePasswordStrength(req.body.password);
            if (!pwCheck.valid) {
                return reply.code(400).send({ error: pwCheck.message });
            }
            updateUserData.password = req.body.password;
        };

        const updateClientAdminData = {};
        if (req.body.hasOwnProperty('aiSelektWaId') && req.body.aiSelektWaId != existingClient.aiSelektWaId) updateClientAdminData.aiSelektWaId = req.body.aiSelektWaId;
        if (req.body.hasOwnProperty('totalCredit') && req.body.totalCredit != existingClient.totalCredit) updateClientAdminData.totalCredit = req.body.totalCredit;
        if (req.body.hasOwnProperty('creditRatePerCall') && req.body.creditRatePerCall != existingClient.creditRatePerCall) updateClientAdminData.creditRatePerCall = req.body.creditRatePerCall;
        if (req.body.hasOwnProperty('videoInterviewCredit') && req.body.videoInterviewCredit != existingClient.videoInterviewCredit) updateClientAdminData.videoInterviewCredit = req.body.videoInterviewCredit;

        let updatedClientAdminForResponse = null;

        try {
            const updateUserKeys = Object.keys(updateUserData);
            if (updateUserKeys.length > 0) {
                let userDoc = await req.conn.models.User.findById(existingClient.user._id);
                for (const key of updateUserKeys) {
                    userDoc[key] = updateUserData[key];
                }
                await userDoc.save();

                updatedClientAdminForResponse = await req.conn.models.ClientAdmin.findById(existingClient._id).populate('user').lean();
            }

            const updateClientAdminKeys = Object.keys(updateClientAdminData);
            if (updateClientAdminKeys.length > 0) {
                const clientAdminDoc = await req.conn.models.ClientAdmin.findById(existingClient._id);
                for (const key of updateClientAdminKeys) {
                    clientAdminDoc[key] = updateClientAdminData[key];
                }
                await clientAdminDoc.save();

                updatedClientAdminForResponse = await req.conn.models.ClientAdmin.findById(existingClient._id).populate('user').lean();
            }
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            console.log("❌ Invalid Client-Admin data, cause: ", err);
            return reply.code(500).send({ error: 'Failed to update client-admin' });
        }

        const finalResponse = updatedClientAdminForResponse || existingClient;

        return reply.send(finalResponse);
    });


    // DELETE 
    fastify.delete('/:clientId', async (req, reply) => {
        if (req.user.role !== 'ultra_admin') {
            return reply
                .code(403)
                .send({ error: `Client-Admin deletion unavailable for this user...` });
        }

        const { clientId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(clientId)) {
            return reply.code(400).send({ error: 'Invalid client ID format' });
        }

        const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);

        let existingClientAdmin = await globalConn.models.ClientAdmin.findOne({ _id: clientId });
        if (!existingClientAdmin) {
            existingClientAdmin = await globalConn.models.ClientAdmin.findOne({ client: clientId });
        }
        if (!existingClientAdmin) {
            return reply.code(404).send({ error: 'ClientAdmin record not found' });
        }
        await svc.delete(existingClientAdmin._id, req);
        return reply.code(204).send();
    });

    // ARCHIVED list 
    fastify.get('/archived', async (req, reply) => {
        if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
            return reply
                .code(403)
                .send({ error: `Client-Admin access unavailable for this user...` });
        }

        try {
            const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);

            const archivedList = await globalConn?.models?.ClientAdmin
                .find({ isArchived: true })
                .populate({ path: 'user' })
                .lean();

            return reply.send(archivedList);
        } catch (err) {
            console.log('❌ Failed to fetch archived client-admins:', err);
            return reply.code(500).send({ error: 'Failed to fetch archived client-admins' });
        }
    });

    // ARCHIVE (soft) 
    fastify.put('/:clientId/archive', async (req, reply) => {
        if (req.user.role !== 'ultra_admin') {
            return reply
                .code(403)
                .send({ error: `Client-Admin archive unavailable for this user...` });
        }

        const { clientId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(clientId)) {
            return reply.code(400).send({ error: 'Invalid client ID format' });
        }

        try {
            // try by _id
            let archivedClientAdmin = await req.conn.models.ClientAdmin.findByIdAndUpdate(
                clientId,
                { $set: { isArchived: true } },
                { new: true }
            ).populate('user').lean();

            if (!archivedClientAdmin) {
                // try by client field
                archivedClientAdmin = await req.conn.models.ClientAdmin.findOneAndUpdate(
                    { client: clientId },
                    { $set: { isArchived: true } },
                    { new: true }
                ).populate('user').lean();
            }

            if (!archivedClientAdmin) {
                return reply.code(404).send({ error: 'ClientAdmin record not found' });
            }

            const userIdToArchive = archivedClientAdmin?.client || archivedClientAdmin?.user?._id;
            if (userIdToArchive) {
                await req.conn.models.User.findByIdAndUpdate(userIdToArchive, { $set: { isArchived: true } });
            }

            return reply.send(archivedClientAdmin);
        } catch (err) {
            console.log('❌ Error archiving client-admin:', err);
            return reply.code(500).send({ error: 'Failed to archive client-admin' });
        }
    });

    // UNARCHIVE (soft restore) 
    fastify.put('/:clientId/unarchive', async (req, reply) => {
        if (req.user.role !== 'ultra_admin') {
            return reply
                .code(403)
                .send({ error: `Client-Admin unarchive unavailable for this user...` });
        }

        const { clientId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(clientId)) {
            return reply.code(400).send({ error: 'Invalid client ID format' });
        }

        try {
            // try by _id
            let unarchivedClientAdmin = await req.conn.models.ClientAdmin.findByIdAndUpdate(
                clientId,
                { $set: { isArchived: false } },
                { new: true }
            ).populate('user').lean();

            if (!unarchivedClientAdmin) {
                // try by client field
                unarchivedClientAdmin = await req.conn.models.ClientAdmin.findOneAndUpdate(
                    { client: clientId },
                    { $set: { isArchived: false } },
                    { new: true }
                ).populate('user').lean();
            }

            if (!unarchivedClientAdmin) {
                return reply.code(404).send({ error: 'ClientAdmin record not found' });
            }

            const userIdToUnarchive = unarchivedClientAdmin?.client || unarchivedClientAdmin?.user?._id;
            if (userIdToUnarchive) {
                await req.conn.models.User.findByIdAndUpdate(userIdToUnarchive, { $set: { isArchived: false } });
            }

            return reply.send(unarchivedClientAdmin);
        } catch (err) {
            console.log('❌ Error unarchiving client-admin:', err);
            return reply.code(500).send({ error: 'Failed to unarchive client-admin' });
        }
    });

}
