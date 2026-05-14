// src/services/candidateATSService.js
import mongoose from 'mongoose';
import CRUDService from './crudBase.js';

export default class CandidateATSService extends CRUDService {
    constructor() {
        super('CandidateATS');
    }

    /* --------------------------- LIST (ATS view data) --------------------------- */
    async getATSListView(payload, user, client, conn) {
        try {
            const Candidate = conn.models['Candidate'];
            const CandidateATS = conn.models['CandidateATS'];

            const {
                page = undefined,
                pageSize = undefined,
                sortBy = undefined,
                sortOrder = undefined,
                search = undefined,
                filterField = undefined,
                filterValue = undefined,
                dateFrom = undefined,
                dateTo = undefined,
                candidateId = undefined,
                jobId = undefined
            } = payload || {};

            const hasServerSide =
                page !== undefined ||
                pageSize !== undefined ||
                sortBy ||
                sortOrder ||
                (search && String(search).trim()) ||
                filterField ||
                filterValue ||
                dateFrom ||
                dateTo ||
                candidateId ||
                jobId;

            if (!hasServerSide) {
                let list = await Candidate
                    .find({ client, isArchived: false })
                    .select('firstName lastName email countryCode phoneNumber skills applications eventIds createdAt')
                    .populate({
                        path: 'eventIds',
                        select: 'eventAt eventName',
                        populate: {
                            path: 'eventName',
                            model: 'EventName',
                            select: 'name userId',
                            match: { name: 'Created' },
                        }
                    })
                    .populate({
                        path: 'applications',
                        select: 'title job stageResults',
                        populate: [
                            {
                                path: 'job',
                                select: 'title internalTitle company',
                                populate: { path: 'company', select: 'name' }
                            },
                            {
                                path: 'stageResults',
                                populate: {
                                    path: 'stage',
                                    select: 'title description createdAt',
                                    match: { isArchived: false }
                                }
                            }
                        ]
                    })
                    .lean()
                    .exec();

                // recruiters see only their created candidates
                if (user?.role === 'recruiter') {
                    list = list.filter(candidate =>
                        candidate.eventIds?.some(event =>
                            event?.eventName?.name &&
                            event?.eventName?.userId &&
                            event.eventName.name === 'Created' &&
                            `${event.eventName.userId}` === `${user._id}`
                        )
                    );
                }

                // strip eventIds, filter out stageResults whose populated stage is null,
                // and sort stageResults by Stage.createdAt (oldest first)
                list = list.map(cand => {
                    const applications = (cand.applications || []).map(app => {
                        const stageResults = (app.stageResults || [])
                            .filter(sr => sr?.stage)
                            .sort((a, b) => {
                                const aTime = a.stage?.createdAt
                                    ? new Date(a.stage.createdAt).getTime()
                                    : 0;
                                const bTime = b.stage?.createdAt
                                    ? new Date(b.stage.createdAt).getTime()
                                    : 0;
                                return aTime - bTime;
                            });

                        return { ...app, stageResults };
                    });

                    return { ...cand, applications, eventIds: [] };
                });

                return { ok: true, code: 200, message: '', items: list };
            }

            const escapeRegex = (value) =>
                String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const buildRegex = (value, exact = false) => {
                const safe = escapeRegex(value);
                return new RegExp(exact ? `^${safe}$` : safe, 'i');
            };

            const baseMatch = { client, isArchived: false };

            const normalizedCandidateId = String(candidateId || '').trim();
            const normalizedJobId = String(jobId || '').trim();

            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const pageSizeNum = Math.min(100, parseInt(pageSize, 10) || 10);

            let jobCandidateIds = null;
            if (normalizedJobId) {
                if (!mongoose.Types.ObjectId.isValid(normalizedJobId)) {
                    return {
                        ok: true,
                        code: 200,
                        message: '',
                        items: [],
                        meta: { total: 0, page: pageNum, pageSize: pageSizeNum, totalPages: 0 }
                    };
                }
                jobCandidateIds = await CandidateATS.distinct('candidate', {
                    client,
                    job: new mongoose.Types.ObjectId(normalizedJobId)
                });
                if (!jobCandidateIds.length) {
                    return {
                        ok: true,
                        code: 200,
                        message: '',
                        items: [],
                        meta: { total: 0, page: pageNum, pageSize: pageSizeNum, totalPages: 0 }
                    };
                }
                baseMatch._id = { $in: jobCandidateIds };
            }

            if (normalizedCandidateId) {
                if (!mongoose.Types.ObjectId.isValid(normalizedCandidateId)) {
                    return {
                        ok: true,
                        code: 200,
                        message: '',
                        items: [],
                        meta: { total: 0, page: pageNum, pageSize: pageSizeNum, totalPages: 0 }
                    };
                }
                if (baseMatch._id?.$in?.length && !baseMatch._id.$in.some(id => String(id) === normalizedCandidateId)) {
                    return {
                        ok: true,
                        code: 200,
                        message: '',
                        items: [],
                        meta: { total: 0, page: pageNum, pageSize: pageSizeNum, totalPages: 0 }
                    };
                }
                baseMatch._id = new mongoose.Types.ObjectId(normalizedCandidateId);
            }

            const pipeline = [{ $match: baseMatch }];

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
                normalizedValue &&
                normalizedValue !== 'all'
            ) {
                const exactRegex = buildRegex(normalizedValue, true);
                pipeline.push({ $match: { [normalizedField]: exactRegex } });
            }

            if (user?.role === 'recruiter') {
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
                            createdByUserId: { $arrayElemAt: ['$createdEventNames.userId', 0] }
                        }
                    },
                    { $match: { createdByUserId: user._id } }
                );
            }

            const searchTerm = String(search || '').trim();
            let jobSearchCandidateIds = [];
            if (searchTerm) {
                const searchRegex = buildRegex(searchTerm, false);
                const jobs = await conn.models['Job']
                    .find(
                        {
                            client,
                            isArchived: false,
                            $or: [{ title: searchRegex }, { internalTitle: searchRegex }]
                        },
                        { _id: 1 }
                    )
                    .lean()
                    .exec();
                if (jobs?.length) {
                    const jobIds = jobs.map(j => j._id);
                    jobSearchCandidateIds = await CandidateATS.distinct('candidate', {
                        client,
                        job: { $in: jobIds }
                    });
                }
                const or = [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex },
                    { phoneNumber: searchRegex }
                ];
                if (jobSearchCandidateIds.length) {
                    or.push({ _id: { $in: jobSearchCandidateIds } });
                }
                pipeline.push({ $match: { $or: or } });
            }

            const skip = (pageNum - 1) * pageSizeNum;

            const sortDir = String(sortOrder || '').toLowerCase() === 'asc' ? 1 : -1;
            let sortStage = { $sort: { createdAt: sortDir, _id: 1 } };
            if (sortBy === 'candidateName') {
                sortStage = { $sort: { firstName: sortDir, lastName: sortDir, _id: 1 } };
            } else if (sortBy === 'firstName') {
                sortStage = { $sort: { firstName: sortDir, _id: 1 } };
            } else if (sortBy === 'lastName') {
                sortStage = { $sort: { lastName: sortDir, _id: 1 } };
            } else if (sortBy === 'email') {
                sortStage = { $sort: { email: sortDir, _id: 1 } };
            } else if (sortBy === 'createdAt') {
                sortStage = { $sort: { createdAt: sortDir, _id: 1 } };
            }

            pipeline.push({
                $facet: {
                    items: [
                        sortStage,
                        { $skip: skip },
                        { $limit: pageSizeNum },
                        { $project: { _id: 1 } }
                    ],
                    totalCount: [{ $count: 'count' }]
                }
            });

            const agg = await Candidate.aggregate(pipeline).exec();
            const items = agg?.[0]?.items || [];
            const total = agg?.[0]?.totalCount?.[0]?.count || 0;

            if (!items.length) {
                return {
                    ok: true,
                    code: 200,
                    message: '',
                    items: [],
                    meta: {
                        total,
                        page: pageNum,
                        pageSize: pageSizeNum,
                        totalPages: pageSizeNum ? Math.ceil(total / pageSizeNum) : 1
                    }
                };
            }

            const ids = items.map(i => i._id);
            const idOrder = new Map(ids.map((id, idx) => [String(id), idx]));

            let list = await Candidate
                .find({ _id: { $in: ids }, client, isArchived: false })
                .select('firstName lastName email countryCode phoneNumber skills applications eventIds createdAt')
                .populate({
                    path: 'eventIds',
                    select: 'eventAt eventName',
                    populate: {
                        path: 'eventName',
                        model: 'EventName',
                        select: 'name userId',
                        match: { name: 'Created' },
                    }
                })
                .populate({
                    path: 'applications',
                    select: 'title job stageResults',
                    populate: [
                        {
                            path: 'job',
                            select: 'title internalTitle company',
                            populate: { path: 'company', select: 'name' }
                        },
                        {
                            path: 'stageResults',
                            populate: {
                                path: 'stage',
                                select: 'title description createdAt',
                                match: { isArchived: false }
                            }
                        }
                    ]
                })
                .lean()
                .exec();

            list = list.sort((a, b) => {
                const aIdx = idOrder.get(String(a._id)) ?? 0;
                const bIdx = idOrder.get(String(b._id)) ?? 0;
                return aIdx - bIdx;
            });

            // strip eventIds, filter out stageResults whose populated stage is null,
            // and sort stageResults by Stage.createdAt (oldest first)
            list = list.map(cand => {
                let applications = (cand.applications || []).map(app => {
                    const stageResults = (app.stageResults || [])
                        .filter(sr => sr?.stage)
                        .sort((a, b) => {
                            const aTime = a.stage?.createdAt
                                ? new Date(a.stage.createdAt).getTime()
                                : 0;
                            const bTime = b.stage?.createdAt
                                ? new Date(b.stage.createdAt).getTime()
                                : 0;
                            return aTime - bTime;
                        });

                    return { ...app, stageResults };
                });

                if (normalizedJobId) {
                    applications = applications.filter(app =>
                        String(app.job?._id || app.job) === normalizedJobId
                    );
                }

                return { ...cand, applications, eventIds: [] };
            }).filter(c => (c.applications || []).length > 0);

            const meta = {
                total,
                page: pageNum,
                pageSize: pageSizeNum,
                totalPages: pageSizeNum ? Math.ceil(total / pageSizeNum) : 1
            };

            console.log('[CandidateATSService] getATSListView server-side', {
                page: pageNum,
                pageSize: pageSizeNum,
                total,
                sortBy: sortBy || 'createdAt',
                sortOrder: sortDir === 1 ? 'asc' : 'desc',
                search: searchTerm ? 'on' : 'off',
                filterField: normalizedField || null,
                candidateId: normalizedCandidateId || null,
                jobId: normalizedJobId || null
            });

            return { ok: true, code: 200, message: '', items: list, meta };
        } catch (err) {
            return { ok: false, code: 400, message: err?.message || 'Failed to load ATS list' };
        }
    }

    /* ------------------------------ READ (single) ------------------------------ */
    async getATSDetails(payload, user, client, conn) {
        const { id, includeStageResults = false } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return { ok: false, code: 400, message: 'Invalid ATS ID format' };
        }

        // base read
        let ats = await this.readById(id, { client, user, conn });
        if (!ats) return { ok: false, code: 404, message: 'ATS record not found' };

        // on-demand populate of stageResults
        if (includeStageResults) {
            ats = await conn.models['CandidateATS'].findById(id).populate?.({
                path: 'stageResults',
                select: 'stageStatus remarkOrFeedback',
                populate: {
                    path: 'stage',
                    select: 'title description createdAt',
                    match: { isArchived: false }
                }
            });

            if (ats?.stageResults?.length) {
                ats.stageResults = ats.stageResults
                    .filter(sr => sr?.stage)
                    .sort((a, b) => {
                        const aTime = a.stage?.createdAt
                            ? new Date(a.stage.createdAt).getTime()
                            : 0;
                        const bTime = b.stage?.createdAt
                            ? new Date(b.stage.createdAt).getTime()
                            : 0;
                        return aTime - bTime;
                    });
            }
        }

        return { ok: true, code: 200, message: '', details: { ats } };
    }

    /* ----------------- UPDATE a single StageResult inside an ATS ---------------- */
    async updateStageResult(payload, req) {
        const { atsId, srId, stageStatus = '', remarkOrFeedback = '' } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(atsId) || !mongoose.Types.ObjectId.isValid(srId)) {
            return { ok: false, code: 400, message: 'Invalid ID format' };
        }

        const { conn, client } = req;
        const CandidateATS = conn.models['CandidateATS'];
        const StageResult = conn.models['StageResult'];

        const ats = await CandidateATS.findOne({ _id: atsId, client })
            .populate({
                path: 'stageResults',
                model: 'StageResult',
                select: '_id stage',
            })
            .lean()
            .exec();

        if (!ats) return { ok: false, code: 404, message: 'ATS record not found' };

        const srIdStr = String(srId);
        const chain = (ats.stageResults || []).map(ele => String(ele?._id));
        if (!chain.includes(srIdStr)) {
            return { ok: false, code: 400, message: 'StageResult not associated with this ATS' };
        }

        // index of SR to modify
        const modifyingIndex = chain.indexOf(srIdStr);
        try {
            const currentSR = ats.stageResults[modifyingIndex];
            const nextSR = await StageResult.findOrCreate(currentSR.stage, stageStatus, remarkOrFeedback, req);

            if (nextSR) {
                const newStageResults = [...ats.stageResults];
                newStageResults[modifyingIndex] = nextSR._id;

                await CandidateATS.findOneAndUpdate(
                    { _id: ats._id, client },
                    { stageResults: newStageResults },
                    { new: true, runValidators: true }
                );
            }
            return { ok: true, code: 200, message: '' };
        } catch (e) {
            return { ok: false, code: 500, message: 'Failed to update stage result' };
        }
    }
}
