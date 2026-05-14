import CompanyService from '../services/companyService.js';
import EventService from '../services/eventService.js';
import mongoose from 'mongoose';
import { requirePermission } from '../utils/permissionUtils.js';

export default async function companyRoutes(fastify) {
    const svc = new CompanyService();
    const logger = new EventService();

    fastify.addHook('preHandler', fastify.authenticate);

    // CREATE
    fastify.post('/', { preHandler: [requirePermission('company')] }, async (req, reply) => {
        const companyCreRes = await svc.createCompany(req.body, req.user, req.client, req.conn);
        return reply.code(companyCreRes?.code).send(companyCreRes);
    });

    // LIST
    fastify.get('/', async (req, reply) => {
        const companyListRes = await svc.getCompanies(req?.query || {}, req?.user, req.client, req.conn);
        if (companyListRes?.meta) {
            return reply.code(companyListRes?.code || 200).send(companyListRes);
        }
        return reply.code(companyListRes?.code || 200).send(companyListRes?.items);
    });

    // READ
    fastify.get('/:id', async (req, reply) => {
        const companyDetailRes = await svc.getCompanyDetails({ id: req.params.id }, req.user, req.client, req.conn);
        return reply
            .code(companyDetailRes?.code || 200)
            .send({ ...(companyDetailRes?.details?.company || companyDetailRes), _id: req.params.id });
    });

    // UPDATE
    fastify.put('/:id', { preHandler: [requirePermission('company')] }, async (req, reply) => {
        const { id } = req.params;
        const companyUpdateRes = await svc.updateCompany({ id, ...req?.body || {} }, req.user, req.client, req.conn);
        return reply.code(companyUpdateRes?.code || 200).send(companyUpdateRes?.details?.updated || companyUpdateRes);
    });

    // DELETE (soft delete via archive)
    fastify.delete('/:id', { preHandler: [requirePermission('company')] }, async (req, reply) => {
        const { id } = req.params;
        try {
            await svc.archiveCompany({ id }, req.user, req.client, req.conn);
            return reply.code(204).send();
        } catch (err) {
            return reply.code(err?.code || 400).send(err.message);
        }
    });

    // LIST (archived)
    fastify.get('/archived', { preHandler: [requirePermission('company')] }, async (req, reply) => {
        const companyListRes = await svc.getCompanies({ ...req?.query || {}, isArchived: true }, req?.user, req.client, req.conn);
        if (companyListRes?.meta) {
            return reply.code(companyListRes?.code || 200).send(companyListRes);
        }
        return reply.code(companyListRes?.code || 200).send(companyListRes?.items);
    });

    // ARCHIVE (soft delete helper)
    fastify.put('/:id/archive', { preHandler: [requirePermission('company')] }, async (req, reply) => {
        const { id } = req.params;
        const res = await svc.updateCompany({ id, isArchived: true }, req.user, req.client, req.conn, true);
        return reply.code(res?.code || 200).send(res?.details?.updated || res);
    });

    // UNARCHIVE
    fastify.put('/:id/unarchive', { preHandler: [requirePermission('company')] }, async (req, reply) => {
        const { id } = req.params;
        const res = await svc.updateCompany({ id, isArchived: false }, req.user, req.client, req.conn, true);
        return reply.code(res?.code || 200).send(res?.details?.updated || res);
    });
}
