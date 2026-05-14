import mongoose from 'mongoose';
import CRUDService from './crudBase.js';

const isValidHttpUrl = (value = '') => {
    if (!value || typeof value !== 'string') return false;
    try {
        const url = new URL(value.trim());
        const protocolOk = ['http:', 'https:'].includes(url.protocol);
        const hostnameOk = Boolean(url.hostname) && (url.hostname.includes('.') || ['localhost', '127.0.0.1'].includes(url.hostname));
        return protocolOk && hostnameOk;
    } catch (_err) {
        return false;
    }
};

export default class CompanyService extends CRUDService {
    constructor() {
        super('Company');
    }

    // CREATE
    async createCompany(payload, user, client, conn) {
        const { name } = payload || {};

        try {
            if (!name?.trim()) {
                return { ok: false, code: 400, message: 'Company name is required' };
            }

            const website = typeof payload?.website === 'string' ? payload.website.trim() : payload?.website;
            if (!website) {
                return { ok: false, code: 400, message: 'Website is required' };
            }
            if (!isValidHttpUrl(website)) {
                return { ok: false, code: 400, message: 'Website must be a valid http(s) URL (e.g., https://example.com)' };
            }

            const dup = await conn.models[this.ModelName].findOne({ name, client }).lean();
            if (dup) {
                return {
                    ok: false,
                    code: 409,
                    message: 'Duplicate company: a company with the same name already exists.'
                };
            }

            let createdBy = user?._id || user?.sub || null;
            const created = await this.create({ ...payload, website, createdBy }, { client, user, conn });

            // console.log('[CompanyService.createCompany] created:', {
            //   id: created?._id?.toString?.(),
            //   name: created?.name,
            //   createdBy: created?.createdBy?.toString?.()
            // });

            return {
                ok: true,
                code: 201,
                message: 'Company created successfully...',
                details: { company: created }
            };
        } catch (err) {
            // console.log('[CompanyService.createCompany] ERROR:', err);
            return {
                ok: err?.status || false,
                code: err?.code || 400,
                message: err?.message || 'Error in company creation...',
                details: err?.errors && Object.values(err?.errors).map(e => e.message),
            };
        }
    }

    // LIST
    async getCompanies(payload, user, client, conn) {
        const {
            ids = undefined,
            fields = undefined,
            getEvents = undefined,
            viewMode = undefined,
            limit = undefined,
            userId = undefined,
            isArchived = false,
            page = undefined,
            pageSize = undefined,
            sortBy = undefined,
            sortOrder = undefined,
            search = undefined,
            filterField = undefined,
            filterValue = undefined,
            dateFrom = undefined,
            dateTo = undefined
        } = payload || {};

        const filter = { isArchived, client };

        if (ids) {
            const rawIds = Array.isArray(ids) ? ids.join(',') : ids;
            const idsArray = rawIds
                .split(',')
                .map(s => s.trim())
                .filter(mongoose.Types.ObjectId.isValid);
            if (idsArray.length) filter._id = { $in: idsArray };
        }

        const hasServerSide =
            page !== undefined ||
            pageSize !== undefined ||
            sortBy ||
            sortOrder ||
            (search && String(search).trim()) ||
            filterField ||
            filterValue ||
            dateFrom ||
            dateTo;

        if (!hasServerSide) {
            let projection;
            if (fields) {
                const fld = String(fields)
                    .split(',')
                    .map(f => f.trim())
                    .filter(Boolean)
                    .join(' ');
                if (fld) projection = fld;
            }

            const populates = [];
            if (getEvents || viewMode) {
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
            // we need createdBy (User) to render its display name
            populates.push({ path: 'createdBy', select: 'firstName lastName email' });

            // console.log('[CompanyService.getCompanies] filter=', filter, 'viewMode=', viewMode);

            let companies = await conn.models[this.ModelName]
                .find(filter, projection)
                .populate(populates)
                .lean()
                .exec();

            // console.log('[CompanyService.getCompanies] loaded count=', companies.length);

            // Optional filtering by creator (like Jobs)
            if (viewMode === 'me') {
                companies = companies.filter(c =>
                    c.eventIds?.some(event =>
                        event?.eventName?.name === 'Created' &&
                        event?.eventName?.userId &&
                        `${event.eventName?.userId}` === `${user._id}`
                    )
                );
            } else if (viewMode === 'byUser') {
                const uid = String(userId || '').trim();
                if (!uid) {
                    return { ok: false, code: 400, message: 'userId is required for viewMode=byUser' };
                }
                companies = companies.filter(c =>
                    c.eventIds?.some(event =>
                        event?.eventName?.name === 'Created' &&
                        event?.eventName?.userId &&
                        `${event?.eventName?.userId}` === uid
                    )
                );
            }

            if (limit) {
                companies = companies.reverse().slice(0, parseInt(limit) || companies.length);
            }

            const nameFromUser = (u) =>
                u ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || '—') : '';

            const items = companies.map(c => {
                // 1) prefer populated createdBy (new records)
                let createdByDisplay = nameFromUser(c.createdBy);

                // 2) fallback to Created event’s user (old records)
                if (!createdByDisplay) {
                    const createdEv = (c.eventIds || []).find(e => e?.eventName?.name === 'Created');
                    createdByDisplay = nameFromUser(createdEv?.eventName?.userId) || '—';
                }

                // keep frontend happy: expose `createdBy` (not createdByName)
                const createdAtStr =
                    c.createdAt instanceof Date
                        ? c.createdAt.toISOString().substring(0, 10)
                        : (c.createdAt?.toString?.().substring(0, 10) || '');

                // strip events (payload diet)
                c.eventIds = [];

                return {
                    ...c,
                    id: c._id,
                    createdBy: createdByDisplay,
                    createdAt: createdAtStr,
                };
            });

            // console.log('[CompanyService.getCompanies] returning items=', items.length,
            //   'sample=', items[0] ? { id: items[0].id, name: items[0].name, createdBy: items[0].createdBy } : null);

            return { ok: true, code: 200, message: '', items };
        }

        const escapeRegex = (value) =>
            String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const buildRegex = (value, exact = false) => {
            const safe = escapeRegex(value);
            return new RegExp(exact ? `^${safe}$` : safe, 'i');
        };

        const pipeline = [{ $match: filter }];

        const normalizedField = String(filterField || '').trim();
        const normalizedValue = String(filterValue || '').trim();

        if (normalizedField === 'createdAt' && (dateFrom || dateTo)) {
            const dateMatch = {};
            const fromVal = String(dateFrom || '').trim();
            const toVal = String(dateTo || '').trim();
            if (fromVal) {
                const fromDate = new Date(`${fromVal}T00:00:00.000Z`);
                if (!Number.isNaN(fromDate.getTime())) {
                    dateMatch.$gte = fromDate;
                }
            }
            if (toVal) {
                const toDate = new Date(`${toVal}T23:59:59.999Z`);
                if (!Number.isNaN(toDate.getTime())) {
                    dateMatch.$lte = toDate;
                }
            }
            if (Object.keys(dateMatch).length) {
                pipeline.push({ $match: { createdAt: dateMatch } });
            }
        } else if (
            normalizedField &&
            normalizedField !== 'all' &&
            normalizedField !== 'createdBy' &&
            normalizedValue &&
            normalizedValue !== 'all'
        ) {
            const exactRegex = buildRegex(normalizedValue, true);
            pipeline.push({ $match: { [normalizedField]: exactRegex } });
        }

        pipeline.push(
            {
                $lookup: {
                    from: 'events',
                    localField: 'eventIds',
                    foreignField: '_id',
                    as: 'events'
                }
            },
            {
                $lookup: {
                    from: 'eventnames',
                    localField: 'events.eventName',
                    foreignField: '_id',
                    as: 'eventNames'
                }
            },
            {
                $addFields: {
                    createdEventNames: {
                        $filter: {
                            input: '$eventNames',
                            as: 'en',
                            cond: { $eq: ['$$en.name', 'Created'] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    createdByEventUserId: { $arrayElemAt: ['$createdEventNames.userId', 0] }
                }
            },
            {
                $addFields: {
                    createdByUserId: { $ifNull: ['$createdBy', '$createdByEventUserId'] }
                }
            }
        );

        if (viewMode === 'me') {
            if (user?._id) {
                pipeline.push({ $match: { createdByUserId: user._id } });
            }
        } else if (viewMode === 'byUser') {
            const uid = String(userId || '').trim();
            if (!uid) {
                return { ok: false, code: 400, message: 'userId is required for viewMode=byUser' };
            }
            if (!mongoose.Types.ObjectId.isValid(uid)) {
                return { ok: false, code: 400, message: 'Invalid userId format' };
            }
            pipeline.push({ $match: { createdByUserId: new mongoose.Types.ObjectId(uid) } });
        }

        pipeline.push(
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdByUserId',
                    foreignField: '_id',
                    as: 'createdByDoc'
                }
            },
            { $unwind: { path: '$createdByDoc', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    createdByName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ['$createdByDoc.firstName', ''] },
                                    ' ',
                                    { $ifNull: ['$createdByDoc.lastName', ''] }
                                ]
                            }
                        }
                    },
                    createdByEmail: '$createdByDoc.email'
                }
            }
        );

        if (normalizedField === 'createdBy' && normalizedValue && normalizedValue !== 'all') {
            const exactRegex = buildRegex(normalizedValue, true);
            pipeline.push({
                $match: {
                    $or: [
                        { createdByName: exactRegex },
                        { createdByEmail: exactRegex }
                    ]
                }
            });
        }

        const searchTerm = String(search || '').trim();
        if (searchTerm) {
            const searchRegex = buildRegex(searchTerm, false);
            pipeline.push({
                $match: {
                    $or: [
                        { name: searchRegex },
                        { industry: searchRegex },
                        { size: searchRegex },
                        { website: searchRegex },
                        { createdByName: searchRegex },
                        { createdByEmail: searchRegex }
                    ]
                }
            });
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSizeNum = Math.min(100, parseInt(pageSize, 10) || 10);
        const skip = (pageNum - 1) * pageSizeNum;

        const sortMap = {
            name: 'name',
            industry: 'industry',
            size: 'size',
            website: 'website',
            createdBy: 'createdByName',
            createdAt: 'createdAt',
            id: '_id'
        };

        const sortField = sortMap[sortBy] || 'createdAt';
        const sortDir = String(sortOrder || '').toLowerCase() === 'asc' ? 1 : -1;

        pipeline.push({
            $facet: {
                items: [
                    { $sort: { [sortField]: sortDir, _id: 1 } },
                    { $skip: skip },
                    { $limit: pageSizeNum },
                    {
                        $project: {
                            events: 0,
                            eventNames: 0,
                            createdEventNames: 0,
                            createdByDoc: 0
                        }
                    }
                ],
                totalCount: [{ $count: 'count' }]
            }
        });

        const agg = await conn.models[this.ModelName].aggregate(pipeline).exec();
        const rawItems = agg?.[0]?.items || [];
        const total = agg?.[0]?.totalCount?.[0]?.count || 0;

        const items = rawItems.map(c => {
            const createdByDisplay = c.createdByName || c.createdByEmail || 'ƒ?"';
            const createdAtStr =
                c.createdAt instanceof Date
                    ? c.createdAt.toISOString().substring(0, 10)
                    : (c.createdAt?.toString?.().substring(0, 10) || '');

            const {
                createdByDoc,
                createdByName,
                createdByEmail,
                createdByUserId,
                createdByEventUserId,
                events,
                eventNames,
                createdEventNames,
                ...rest
            } = c;

            return {
                ...rest,
                id: c._id,
                createdBy: createdByDisplay,
                createdAt: createdAtStr,
                eventIds: []
            };
        });

        const meta = {
            total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: pageSizeNum ? Math.ceil(total / pageSizeNum) : 1
        };

        console.log('[CompanyService] getCompanies server-side', {
            page: pageNum,
            pageSize: pageSizeNum,
            total,
            sortBy: sortField,
            sortOrder: sortDir === 1 ? 'asc' : 'desc',
            search: searchTerm ? 'on' : 'off',
            filterField: normalizedField || null,
            viewMode: viewMode || 'all'
        });

        return { ok: true, code: 200, message: '', items, meta };
    }

    // READ
    async getCompanyDetails(payload, user, client, conn) {
        const { id } = payload || {};

        let company;
        try {
            company = await this.readById(id, { client, user, conn }, 'getEvents' in payload);
        } catch (err) {
            return { ok: false, code: err?.code || 400, message: err?.message || 'Invalid company ID format' };
        }
        if (!company) {
            return { ok: false, code: 404, message: 'Company not found' };
        }

        return { ok: true, code: 200, message: '', details: { company } };
    }

    // UPDATE
    async updateCompany(payload, user, client, conn, updateArchived = false) {
        const { id, ...rest } = payload || {};
        const updates = { ...rest };

        if ('website' in rest) {
            const website = typeof rest.website === 'string' ? rest.website.trim() : rest.website;
            if (!website) {
                return { ok: false, code: 400, message: 'Website is required' };
            }
            if (!isValidHttpUrl(website)) {
                return { ok: false, code: 400, message: 'Website must be a valid http(s) URL (e.g., https://example.com)' };
            }
            updates.website = website;
        }

        let updated;
        try {
            updated = await this.update(id, updates, { user, client, conn }, false, updateArchived);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return {
                    ok: true,
                    code: 400,
                    message: 'Invalid company data',
                    details: Object.values(err.errors).map(e => e.message)
                };
            }
            if (err.name === 'CastError' && err.kind === 'ObjectId') {
                return { ok: true, code: 400, message: 'Invalid company ID format' };
            }
            return { ok: true, code: err?.code || 400, message: err?.message || err };
        }

        if (!updated) {
            return { ok: false, code: 404, message: 'Company not found' };
        }

        return { ok: true, code: 200, message: '', details: { updated } };
    }

    // ARCHIVE (soft delete)
    async archiveCompany(payload, user, client, conn) {
        const { id } = payload || {};
        let deleted;
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return { ok: false, code: 400, message: 'Invalid company ID format' };
            }
            const existed = await this.readById(id, { user, client, conn });
            if (!existed) {
                return { ok: false, code: 404, message: 'Company not found' };
            }
            deleted = await this.delete(id, { user, client, conn });
        } catch (err) {
            return { ok: false, code: 400, message: err?.message || 'Error in company deletion...' };
        }

        return { ok: true, code: 200, message: '', details: { deleted } };
    }

    // UNARCHIVE helper
    async unarchiveCompany(payload, user, client, conn) {
        const { id } = payload || {};
        return this.updateCompany({ id, isArchived: false }, user, client, conn, true);
    }
}
