import mongoose from 'mongoose';

import CRUDService from './crudBase.js';
import { chatCompletionByOpenAI } from '../utils/aiChatCompletions.js';
import RelevancyService, { enqueueJobRelevancy } from './relevancyService.js';


export default class JobService extends CRUDService {
    constructor() {
        super('Job');
    }

    async getShortJobDescription(fullDescription, req) {
        const messages = [
            {
                role: "system",
                content: `
    You are a helpful assistant whose sole job is to turn a long, detailed job description
    into a concise “Short JD” (no more than 2-3 sentences).`
            },
            {
                role: "user",
                content: `
    Please summarize the following job description into a short JD (2-3 sentences max):
    
    ${fullDescription}`
            }
        ];

        try {
            const completion = await chatCompletionByOpenAI(messages, req);
            const shortJD = completion.choices[0].message.content?.trim();
            return shortJD || fullDescription;

        } catch (err) {
            console.log("❌ Error in getting short job description: ", err);
            return fullDescription;
        }
    }

    async createJob(payload, user, client, conn) {

        const { title, company, experience: { min, max } } = payload;

        const dup = await conn.models[this.ModelName].findOne({
            title,
            company,
            'experience.min': min,
            'experience.max': max
        }).lean();
        if (dup) {
            return {
                ok: false,
                code: 409,
                message:
                    'Duplicate job: a job with the same title, experience range, and company already exists.'
            };
        }

        let job;
        try {
            const createdBy = user?._id || user?.sub;
            job = await this.create({ ...payload, createdBy }, { client, user, conn });

        } catch (err) {
            console.log("Error in creating job: ", err);

            return {
                ok: err?.status || false,
                code: err?.code || 400,
                message: err?.message || "Error in job creation...",
                details:
                    err?.errors &&
                    Object.values(err?.errors).map(e => e.message),
            };
        }

        try {
            const createdDescription = String(job?.description || '').trim();
            const createdShortDescription = String(job?.shortDescription || '').trim();
            const payloadDescription = String(payload?.description || '').trim();
            const shouldGenerateShortDescription =
                Boolean(createdDescription) &&
                (!createdShortDescription || (payloadDescription && payloadDescription !== createdDescription));

            if (shouldGenerateShortDescription) {
                const shortJD = await this.getShortJobDescription(
                    createdDescription,
                    { conn, client, user }
                );
                job = await conn.models[this.ModelName]
                    .findByIdAndUpdate(
                        job._id,
                        { shortDescription: shortJD },
                        { new: true }
                    )
                    .lean();
            }
        } catch (err) {
            return {
                ok: err?.status || false,
                code: err?.code || 400,
                message:
                    err?.message ||
                    "Error in creating job's short description...",
                details:
                    err?.errors &&
                    Object.values(err?.errors).map(e => e?.message),
            };
        }

        // 🔁 Enqueue relevancy calculation for this job vs all existing candidates
        try {
            enqueueJobRelevancy(job._id, { conn, client, user });
        } catch (err) {
            console.error(
                "[JobService] Failed to enqueue job relevancy on create:",
                err
            );
        }

        return {
            ok: true,
            code: 201,
            message: "Job created successfully...",
            details: {
                job
            },
        };
    }

    async getJobs(payload, user, client, conn) {
        const {
            ids = undefined,
            fields = undefined,
            getEvents = undefined,
            viewMode = undefined,
            resolveCompanies = undefined,
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

        const filter = {
            isArchived,
            client
        };

        if (ids) {
            const rawIds = Array.isArray(ids)
                ? ids.join(',')
                : ids;

            const idsArray = rawIds
                .split(',')
                .map(s => s.trim())
                .filter(mongoose.Types.ObjectId.isValid);

            if (idsArray.length) {
                filter._id = { $in: idsArray };
            }
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
                const fields_ = fields
                    .split(',')
                    .map(f => f.trim())
                    .filter(Boolean)
                    .join(' ');
                if (fields_) projection = fields_;
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

            if (resolveCompanies === 'true') {
                populates.push({ path: 'company', select: 'name' });
            }

            populates.push({ path: 'createdBy', select: 'firstName lastName email' });

            let jobsList = await conn.models['Job']
                .find(filter, projection)
                .populate(populates)
                .lean()
                .exec();

            if (viewMode === 'me') {
                jobsList = jobsList.filter(job =>
                    job.eventIds?.some(
                        event =>
                            event.eventName?.name &&
                            event.eventName?.userId &&
                            event.eventName?.name === 'Created' &&
                            `${event.eventName?.userId}` === `${user._id}`
                    )
                );
            } else if (viewMode === 'byUser') {
                const uid = String(userId || '').trim();
                if (!uid) {
                    return {
                        ok: false,
                        code: 400,
                        message: 'userId is required for viewMode=byUser',
                    };
                }
                jobsList = jobsList.filter(job =>
                    job.eventIds?.some(
                        event =>
                            event?.eventName?.name === 'Created' &&
                            event?.eventName?.userId &&
                            `${event.eventName?.userId}` === uid
                    )
                );
            }

            if (limit) {
                jobsList = jobsList
                    .reverse()
                    .slice(0, parseInt(limit) || jobsList.length);
            }

            const nameFromUser = (u) =>
                u
                    ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
                        u.email ||
                        '—')
                    : '—';

            jobsList = jobsList.map(job => {
                const createdByName = nameFromUser(job.createdBy);
                job.eventIds = [];
                return { ...job, id: job._id, createdByName };
            });

            return {
                ok: true,
                code: 200,
                message: "",
                items: jobsList,
            };
        }

        const escapeRegex = (value) =>
            String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const buildRegex = (value, exact = false) => {
            const safe = escapeRegex(value);
            return new RegExp(exact ? `^${safe}$` : safe, 'i');
        };

        const baseMatch = { ...filter };

        if (viewMode === 'me') {
            if (user?._id) {
                baseMatch.createdBy = user._id;
            }
        } else if (viewMode === 'byUser') {
            const uid = String(userId || '').trim();
            if (!uid) {
                return {
                    ok: false,
                    code: 400,
                    message: 'userId is required for viewMode=byUser',
                };
            }
            if (!mongoose.Types.ObjectId.isValid(uid)) {
                return { ok: false, code: 400, message: 'Invalid userId format' };
            }
            baseMatch.createdBy = uid;
        }

        const pipeline = [{ $match: baseMatch }];

        const includeCompany = String(resolveCompanies || '') === 'true';

        pipeline.push(
            {
                $lookup: {
                    from: 'companies',
                    localField: 'company',
                    foreignField: '_id',
                    as: 'companyDoc'
                }
            },
            { $unwind: { path: '$companyDoc', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdByDoc'
                }
            },
            { $unwind: { path: '$createdByDoc', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    company: includeCompany ? '$companyDoc' : '$company',
                    createdBy: '$createdByDoc',
                    companyName: '$companyDoc.name',
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
                    createdByEmail: '$createdByDoc.email',
                    primaryLocation: { $arrayElemAt: ['$locations', 0] }
                }
            }
        );

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
        } else if (normalizedField && normalizedField !== 'all' && normalizedValue && normalizedValue !== 'all') {
            const exactRegex = buildRegex(normalizedValue, true);
            if (normalizedField === 'company') {
                pipeline.push({ $match: { companyName: exactRegex } });
            } else if (normalizedField === 'createdByName') {
                pipeline.push({
                    $match: {
                        $or: [
                            { createdByName: exactRegex },
                            { createdByEmail: exactRegex }
                        ]
                    }
                });
            } else if (normalizedField === 'locations') {
                pipeline.push({ $match: { locations: exactRegex } });
            } else {
                pipeline.push({ $match: { [normalizedField]: exactRegex } });
            }
        }

        const searchTerm = String(search || '').trim();
        if (searchTerm) {
            const searchRegex = buildRegex(searchTerm, false);
            pipeline.push({
                $match: {
                    $or: [
                        { title: searchRegex },
                        { internalTitle: searchRegex },
                        { jobType: searchRegex },
                        { workMode: searchRegex },
                        { status: searchRegex },
                        { locations: searchRegex },
                        { companyName: searchRegex },
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
            title: 'title',
            internalTitle: 'internalTitle',
            company: 'companyName',
            companyName: 'companyName',
            jobType: 'jobType',
            workMode: 'workMode',
            locations: 'primaryLocation',
            createdByName: 'createdByName',
            createdAt: 'createdAt',
            status: 'status',
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
                            companyDoc: 0,
                            createdByDoc: 0,
                            companyName: 0,
                            createdByEmail: 0,
                            primaryLocation: 0
                        }
                    }
                ],
                totalCount: [{ $count: 'count' }]
            }
        });

        const agg = await conn.models['Job'].aggregate(pipeline).exec();
        const rawItems = agg?.[0]?.items || [];
        const total = agg?.[0]?.totalCount?.[0]?.count || 0;

        const nameFromUser = (u) =>
            u
                ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
                    u.email ||
                    'ƒ?"')
                : 'ƒ?"';

        const items = rawItems.map(job => {
            const createdByName = job.createdByName || nameFromUser(job.createdBy);
            return { ...job, id: job._id, createdByName, eventIds: [] };
        });

        const meta = {
            total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: pageSizeNum ? Math.ceil(total / pageSizeNum) : 1
        };

        console.log('[JobService] getJobs server-side', {
            page: pageNum,
            pageSize: pageSizeNum,
            total,
            sortBy: sortField,
            sortOrder: sortDir === 1 ? 'asc' : 'desc',
            search: searchTerm ? 'on' : 'off',
            filterField: normalizedField || null,
            viewMode: viewMode || 'all'
        });

        return {
            ok: true,
            code: 200,
            message: "",
            items,
            meta
        };
    }

    async getJobDetails(payload, user, client, conn) {
        const { id } = payload;

        let job;
        try {
            job = await this.readById(
                id,
                { client, user, conn },
                'getEvents' in payload
            );
        } catch (err) {
            return {
                ok: false,
                code: err?.code || 400,
                message: err?.message || 'Invalid job ID format'
            };
        }
        if (!job)
            return {
                ok: false,
                code: 404,
                message: 'Job not found',
            };

        return {
            ok: true,
            code: 200,
            message: '',
            details: {
                job
            }
        };
    }

    async updateJob(payload, user, client, conn, updateArchived = false) {
        const { id, ...restPayload } = payload;
        let previousDescription = '';
        if (id && mongoose.Types.ObjectId.isValid(id)) {
            try {
                const previous = await conn.models[this.ModelName]
                    .findById(id)
                    .select('description')
                    .lean();
                previousDescription = String(previous?.description || '').trim();
            } catch (err) {
                console.warn('[JobService] Failed to read previous job description before update:', err?.message || err);
            }
        }

        let updated;
        try {
            updated = await this.update(
                id,
                restPayload,
                { user, client, conn },
                Boolean(restPayload?.salary),
                updateArchived
            );
        } catch (err) {
            console.error("Error in updating job: ", err);

            if (err.name === 'ValidationError') {
                return {
                    ok: false,
                    code: 400,
                    message: 'Invalid job data',
                    details: Object.values(err.errors).map(e => e.message)
                };
            }

            if (err.name === 'CastError' && err.kind === 'ObjectId') {
                return {
                    ok: false,
                    code: 400,
                    message: 'Invalid job ID format'
                };
            }

            return {
                ok: false,
                code: err?.code || 400,
                message: err?.message || String(err)
            };
        }

        if (!updated) {
            return {
                ok: false,
                code: 404,
                message: 'Job not found'
            };
        }

        const updatedDescription = String(updated?.description || '').trim();
        const payloadDescription = String(payload?.description || '').trim();
        const updatedShortDescription = String(updated?.shortDescription || '').trim();
        const descriptionChanged = Boolean(payloadDescription) && payloadDescription !== previousDescription;
        const shouldRefreshShortDescription =
            Boolean(updatedDescription) && (descriptionChanged || !updatedShortDescription);

        if (shouldRefreshShortDescription) {
            try {
                const shortJD = await this.getShortJobDescription(
                    updatedDescription,
                    { conn, client, user }
                );
                updated = await conn.models[this.ModelName]
                    .findByIdAndUpdate(
                        id,
                        { shortDescription: shortJD },
                        { new: true }
                    )
                    .lean();
            } catch (err) {
                console.error(
                    '❌ Failed to regenerate/persist shortDescription:',
                    err
                );
            }
        }

        // 🔁 Enqueue relevancy calculation for this job vs all existing candidates (on update)
        try {
            enqueueJobRelevancy(updated._id, { conn, client, user });
        } catch (err) {
            console.error(
                "[JobService] Failed to enqueue job relevancy on update:",
                err
            );
        }

        // 🔁 After job edit, refresh conversation-based relevancy for this job
        try {
            const jobIdForUpdate = updated._id;
            const clientIdForUpdate = client;
            const connForUpdate = conn;
            const userForUpdate = user;

            setTimeout(async () => {
                try {
                    const Conversation = connForUpdate?.models?.Conversation;
                    if (!Conversation) {
                        console.warn('[JobService] Conversation model not available; skip updateFromConversation');
                        return;
                    }

                    const candidateIds = await Conversation
                        .find({ client: clientIdForUpdate, jobId: jobIdForUpdate, isArchived: false })
                        .distinct('candidateId')
                        .exec();

                    if (!candidateIds?.length) {
                        console.log('[JobService] No conversations found for job after edit', {
                            jobId: String(jobIdForUpdate)
                        });
                        return;
                    }

                    console.log('[JobService] updateFromConversation after job edit', {
                        jobId: String(jobIdForUpdate),
                        candidates: candidateIds.length
                    });

                    const relSvc = new RelevancyService();
                    for (const candidateId of candidateIds) {
                        try {
                            await relSvc.ensurePairRelevancy({
                                client: clientIdForUpdate,
                                candidateId,
                                jobId: jobIdForUpdate,
                                conn: connForUpdate,
                                user: userForUpdate
                            });
                            await relSvc.updateFromConversation({
                                client: clientIdForUpdate,
                                candidateId,
                                jobId: jobIdForUpdate,
                                conn: connForUpdate,
                                user: userForUpdate
                            });
                        } catch (err) {
                            console.error('[JobService] updateFromConversation failed for candidate', {
                                jobId: String(jobIdForUpdate),
                                candidateId: String(candidateId)
                            }, err);
                        }
                    }
                } catch (err) {
                    console.error('[JobService] updateFromConversation batch failed after job edit:', err);
                }
            }, 0);
        } catch (err) {
            console.error('[JobService] Failed to schedule updateFromConversation after job edit:', err);
        }

        return {
            ok: true,
            code: 200,
            message: "",
            details: {
                updated
            }
        };
    }

    async archiveJob(payload, user, client, conn) {
        const { id } = payload;
        let deleted;
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return { ok: false, code: 400, message: 'Invalid job ID format' };
            }
            const existed = await this.readById(id, { user, client, conn });
            if (!existed) {
                return { ok: false, code: 404, message: 'Job not found' };
            }
            deleted = await this.delete(id, { user, client, conn });
        } catch (err) {
            console.error("Error in archive job: ", err);

            return {
                ok: false,
                code: 400,
                message: err?.message || 'Error in job deletion...'
            };
        }

        return {
            ok: true,
            code: 200,
            message: "",
            details: {
                deleted
            }
        };
    }

    async generateBooleanString({ skills, req, secondarySkills = [], excludeJunior = false }) {
        if (!Array.isArray(skills) || skills.length < 1) {
            throw new Error('At least 1 primary skill is required');
        }

        const basePrompt = `
Create a Boolean search string for sourcing candidates with the following skills:

Primary Skills (required): ${skills.join(', ')}
${secondarySkills && secondarySkills.length > 0 ? `Secondary Skills (optional): ${secondarySkills.join(', ')}` : ''}
${excludeJunior ? 'Exclude junior/intern positions' : ''}

Format the string using proper Boolean syntax with parentheses, AND, OR, and NOT operators.
For each skill, include common synonyms or alternative terms using OR.
${excludeJunior ? 'Add terms to exclude junior positions (e.g., NOT intern NOT junior)' : ''}

Example format:
("Skill1" OR "Synonym1" OR "Alternative1") AND ("Skill2" OR "Synonym2") AND ("Skill3" OR "Synonym3") ${excludeJunior ? 'NOT "intern" NOT "junior" NOT "trainee"' : ''}

Return only the Boolean search string without any additional text or explanation.
`.trim();

        try {
            const aiResponse = await chatCompletionByOpenAI(
                [{ role: 'system', content: basePrompt }],
                req
            );

            const rawContent =
                aiResponse.choices?.[0]?.message?.content?.trim();

            if (!rawContent.startsWith('{')) {
                return rawContent;
            }

            const match = rawContent.match(/\{[\s\S]*\}/);
            const jsonBlock = match ? match[0] : rawContent;
            const parsed = JSON.parse(jsonBlock);

            if (!parsed.booleanString) {
                throw new Error('Missing "booleanString" key in AI response');
            }

            return parsed.booleanString;

        } catch (err) {
            console.error('❌ Failed to generate Boolean string:\n', err);
            throw new Error('AI extraction failed or returned invalid format');
        }
    }

    async generateJobDescription({
        title,
        skills,
        req,
        experience = {},
        locations = [],
        salaryRange = {},
        workMode = '',
        educationDetails = []
    }) {
        if (!title?.trim() || !Array.isArray(skills) || skills.length < 3) {
            throw new Error('Job title and at least 3 skills are required');
        }

        const expString = `Min: ${experience.min || 0} yrs, Max: ${experience.max || 0} yrs`;
        const experienceString =
            experience.min || experience.max
                ? `Total Experience: ${expString}`
                : '';
        const jobCurrency = salaryRange?.currency || 'INR';
        const locString = locations.length
            ? `Locations: ${locations.join(', ')}`
            : '';
        const employmentString = workMode ? `Work Mode: ${workMode}` : '';
        const salaryString =
            salaryRange.min != null && salaryRange.max != null
                ? `Salary Range: ${salaryRange.min} – ${salaryRange.max}`
                : '';
        const educationString = educationDetails.length
            ? educationDetails
                .map(
                    ed =>
                        `${ed.qualification} in ${ed.streamOrSpecialization}`
                )
                .join(', ')
            : 'Bachelor’s or Master’s in relevant field';

        const jdPrompt = `
Generate a professional job description for a ${title} position with the following details:

Required Skills: ${skills.join(', ')}
Experience Required: ${expString}
${experienceString}
${locString}
${employmentString}
${salaryString}
Education Requirements: ${educationString}

Format the response as a JSON object with this structure:
{
  "overview": "A compelling overview of the role",
  "responsibilities": [
    "Responsibility 1",
    "Responsibility 2",
    "..."
  ],
  "requirements": [
    "Experience requirements (including min and max years)",
    "Required skills",
    "Education requirements (e.g. B.Tech, M.Tech, etc.)",
    "Any other necessary requirements"
  ],
  "benefits": [
    "Benefit 1",
    "Benefit 2",
    "..."
  ]
}

Ensure that the requirements section includes explicit education requirements: ${educationString}

Important: Whenever you mention salary or compensation, use the job's currency which is ${jobCurrency}. Format salary amounts appropriately for that currency.
    `.trim();

        const aiResponse = await chatCompletionByOpenAI(
            [{ role: 'system', content: jdPrompt }],
            req
        );

        const raw = aiResponse.choices?.[0]?.message?.content?.trim();
        const jsonBlock = raw.match(/\{[\s\S]*\}/)?.[0] || raw;

        let parsed;
        try {
            parsed = JSON.parse(jsonBlock);
            // console.log(
            //     '✅ [generateJobDescription] Parsed JSON object:',
            //     parsed
            // );
        } catch (e) {
            console.error(
                '❌ [generateJobDescription] Failed to parse AI response as JSON:',
                e
            );
            throw new Error('Failed to parse AI response as JSON');
        }

        if (
            typeof parsed.overview !== 'string' ||
            !Array.isArray(parsed.responsibilities) ||
            !Array.isArray(parsed.requirements) ||
            !Array.isArray(parsed.benefits)
        ) {
            console.log(
                '⚠️ [generateJobDescription] Parsed JSON missing expected keys:',
                parsed
            );
            throw new Error('AI returned invalid format for job description');
        }

        return parsed;
    }
}
