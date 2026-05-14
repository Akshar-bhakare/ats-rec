import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import CRUDService from './crudBase.js';
import { extractResumeText as extractResumeText } from '../utils/documentTextExtractor.js';
import { chatCompletionByOpenAI } from '../utils/aiChatCompletions.js';
import { getDownloadURL, uploadBufferToFirebase } from '../utils/firebaseUtils.js';
import { enqueueCandidateRelevancy } from './relevancyService.js'; // 👈 wired into relevancy queue
import { enqueueCandidateEmbedding } from './embeddingQueueService.js';
import { generateEmbedding } from '../utils/embeddingUtils.js';



// Extract the first JSON object/array from a string (LLM outputs often wrap JSON in markdown/text)
const extractJsonObject = (text = '') => {
    if (typeof text !== 'string' || !text.trim()) return null;

    // Try fenced code block ```json ... ```
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidateFromFence = fenceMatch?.[1];

    // Fallback to first {...} or [...]
    const firstCurly = text.indexOf('{');
    const lastCurly = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');

    const candidateFromCurlies =
        firstCurly !== -1 && lastCurly > firstCurly ? text.slice(firstCurly, lastCurly + 1) : null;
    const candidateFromBrackets =
        firstBracket !== -1 && lastBracket > firstBracket ? text.slice(firstBracket, lastBracket + 1) : null;

    const candidates = [candidateFromFence, candidateFromCurlies, candidateFromBrackets].filter(Boolean);

    for (const candidate of candidates) {
        try {
            JSON.parse(candidate);
            return candidate;
        } catch (_) {
            // keep trying other candidates
        }
    }

    return null;
};

// // Normalize skills array and dedupe (case-insensitive)
// const normalizeAndDedupeSkills = (skills) => {
//     if (!Array.isArray(skills)) return [];

//     const cleaned = skills
//         .map((s) => {
//             if (typeof s === 'string') return s.trim();
//             if (s && typeof s === 'object') {
//                 const val = s.skill || s.name || s.title;
//                 return typeof val === 'string' ? val.trim() : '';
//             }
//             return '';
//         })
//         .filter(Boolean)
//         .map((s) => s.replace(/\s+/g, ' '));

//     const seen = new Set();
//     const deduped = [];
//     for (const skill of cleaned) {
//         const key = skill.toLowerCase();
//         if (!seen.has(key)) {
//             seen.add(key);
//             deduped.push(skill);
//         }
//     }
//     return deduped;
// };

export default class CandidateService extends CRUDService {
    constructor() {
        super('Candidate');
        this.stageSvc = new CRUDService('Stage');
        this.stageResultSvc = new CRUDService('StageResult');
        this.candidateATSSvc = new CRUDService('CandidateATS');
        // Toggle verbose section-splitting debug logs with env SECTION_DEBUG=true
        this.sectionDebug = String(process.env.SECTION_DEBUG || '').toLowerCase() === 'true';
    }

    // Single-pass skills extraction with section grouping and evidence
    async runSinglePassSkillsExtraction({ extractedText, req, tag }) {
        const empty = {
            projects: [],
            summary_profile: [],
            experience: [],
            skills_section: [],
        };

        if (!extractedText) return empty;

        const systemPrompt = `Return ONLY valid JSON:
{
  "projects": [{ "skill": "...", "evidence": "..." }],
  "summary_profile": [{ "skill": "...", "evidence": "..." }],
  "experience": [{ "skill": "...", "evidence": "..." }],
  "skills_section": [{ "skill": "...", "evidence": "..." }]
}

Rules:
- Evidence 5–12 words from same section.
- No inferred skills.
- If skill appears in multiple sections, assign to earliest section by priority.
- No duplicate skills across arrays.
- No markdown, no commentary.`;

        const userPrompt = `Resume text:\n"""\n${extractedText}\n"""`;

        try {
            const resp = await chatCompletionByOpenAI(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                req
            );

            const raw = resp?.choices?.[0]?.message?.content || '';
            const jsonStr = extractJsonObject(raw) || raw;
            const parsed = JSON.parse(jsonStr);

            const normalized = { ...empty };
            for (const key of Object.keys(normalized)) {
                const arr = Array.isArray(parsed?.[key]) ? parsed[key] : [];
                normalized[key] = arr
                    .map((item) => {
                        if (item && typeof item === 'object') {
                            const skill = typeof item.skill === 'string' ? item.skill.trim() : '';
                            const evidence = typeof item.evidence === 'string' ? item.evidence.trim() : '';
                            return skill ? { skill, evidence } : null;
                        }
                        if (typeof item === 'string') {
                            return { skill: item.trim(), evidence: '' };
                        }
                        return null;
                    })
                    .filter(Boolean);
            }

            return normalized;
        } catch (err) {
            console.error(`${tag} [SKILLS] GPT parsing error (single pass):`, err);
            return empty;
        }
    }

    // Deterministic reducer honoring section priority
    pickTopSkillsByPriority(sectionedSkills, max = 7) {
        const order = ['projects', 'summary_profile', 'experience', 'skills_section'];
        const seen = new Set();
        const result = [];

        for (const key of order) {
            const items = Array.isArray(sectionedSkills?.[key]) ? sectionedSkills[key] : [];
            for (const item of items) {
                const skill = typeof item === 'string' ? item : item?.skill;
                const val = typeof skill === 'string' ? skill.trim() : '';
                if (!val) continue;
                const dedupeKey = val.toLowerCase();
                if (seen.has(dedupeKey)) continue;
                seen.add(dedupeKey);
                result.push(val);
                if (result.length >= max) return result;
            }
        }

        return result;
    }

    /* ----------------------------- CORE CRUD (Company/Job parity) ----------------------------- */

    // CREATE (optional)
    async createCandidate(payload, user, client, conn) {
        try {
            const {
                firstName,
                lastName,
                email,
                countryCode,
                phoneNumber,
                skills,
                resumeUrl,
                resumeText,
                jobs = []
            } = payload || {};

            const missing = [];
            if (!firstName) missing.push('First Name');
            if (!lastName) missing.push('Last Name');
            if (!email) missing.push('Email');
            if (!countryCode) missing.push('Country Code');
            if (!phoneNumber) missing.push('Phone Number');
            if (!Array.isArray(skills) || skills.length === 0) missing.push('Skills');
            if (!resumeUrl) missing.push('Resume Url');
            if (!resumeText) missing.push('Resume Text');
            if (!Array.isArray(jobs) || jobs.length === 0) missing.push('Job');

            if (missing.length) {
                return { ok: false, code: 400, message: `Missing required field(s): ${missing.join(', ')}` };
            }

            const normalizedEmail = String(email || '').toLowerCase();
            const validJobIds = (Array.isArray(jobs) ? jobs : [])
                .filter((id) => mongoose.Types.ObjectId.isValid(id));

            if (!validJobIds.length) {
                return { ok: false, code: 400, message: 'Job not found...' };
            }

            const jobCount = await conn.models['Job'].countDocuments({
                _id: { $in: validJobIds },
                client
            });
            if (jobCount !== validJobIds.length) {
                return { ok: false, code: 404, message: 'Job not found...' };
            }

            const emailExists = await conn.models['Candidate'].findOne({ email: normalizedEmail, client }).lean();
            if (emailExists) {
                return { ok: false, code: 409, message: 'A candidate with that email already exists.' };
            }

            const mobExists = await conn.models['Candidate'].findOne({ phoneNumber, client }).lean();
            if (mobExists) {
                return { ok: false, code: 409, message: 'A candidate with that mobile number already exists.' };
            }

            const jobApplied = await conn.models['Candidate']
                .findOne({ jobs: { $in: validJobIds }, email: normalizedEmail, client })
                .lean();
            if (jobApplied) {
                return { ok: false, code: 409, message: 'A candidate already applied for that job with that email.' };
            }

            const createdBy = user?._id || user?.sub || null;
            const cleanedPayload = { ...payload, email: normalizedEmail, jobs: validJobIds, createdBy };
            const savedCandidate = await this.create(cleanedPayload, { client, user, conn });

            const jobId = validJobIds[0];
            const req = {
                body: cleanedPayload,
                user,
                client,
                conn,
            };

            let allStages = await this.stageSvc.readAll(req) || [];
            if (allStages?.length <= 0) {
                let newStage = await req.conn.models['Stage'].findOne({ title: "Initial AI Call for Candidate Interest Check", client: req.client }).lean().exec();
                if (!newStage) {
                    newStage = await this.stageSvc.create({ title: "Initial AI Call for Candidate Interest Check", isArchived: false }, req);
                }
                allStages = [newStage];
            }

            let allStageResultIds = [];
            for (const newStage of allStages) {
                const newStageResultDt = { stage: newStage._id, stageStatus: "Not Initiated", remarkOrFeedback: '', isArchived: false, client: req.client };
                let newStageResult = await req.conn.models['StageResult'].findOne(newStageResultDt).lean().exec();
                if (!newStageResult) {
                    newStageResult = await this.stageResultSvc.create(newStageResultDt, req);
                }
                allStageResultIds.push(newStageResult._id);
            }

            const newCanATSDt = {
                title: "Application #1",
                candidate: savedCandidate._id,
                job: jobId,
                stageResults: { $in: allStageResultIds },
            };

            let newCanATS = await req.conn.models['CandidateATS'].findOne(newCanATSDt).lean().exec();
            if (!newCanATS) {
                newCanATS = await this.candidateATSSvc.create({ ...newCanATSDt, stageResults: allStageResultIds }, req);
            }

            await this.update(savedCandidate._id, { $addToSet: { applications: newCanATS._id } }, req);

            // 🔁 Enqueue relevancy for this candidate vs all existing jobs
            try {
                enqueueCandidateRelevancy(savedCandidate._id, { conn, client, user });
            } catch (err) {
                console.error('[CandidateService] Failed to enqueue candidate relevancy on create:', err);
            }

            try {
                console.log('[CandidateService] Enqueuing candidate embedding after save:', savedCandidate._id);
                enqueueCandidateEmbedding(savedCandidate._id, { conn, client, user });
            } catch (err) {
                console.error('[CandidateService] Failed to enqueue candidate embedding on create:', err);
            }

            return { ok: true, code: 201, message: 'Candidate created successfully...', details: { candidate: savedCandidate } };
        } catch (err) {
            return {
                ok: err?.status || false,
                code: err?.code || 400,
                message: err?.message || '—',
                details: err?.errors && Object.values(err?.errors).map(e => e.message),
            };
        }
    }

    // LIST (supports ids, fields, getEvents, viewMode, limit, isArchived)
    async getCandidates(payload, user, client, conn) {
        const {
            ids = undefined,
            fields = undefined,
            getEvents = undefined,
            viewMode = undefined,   // 'me' | 'byUser' (userId required)
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
            const idsArray = rawIds.split(',').map(s => s.trim()).filter(mongoose.Types.ObjectId.isValid);
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

        const hydrateStageSnapshot = async (rows) => {
            if (!Array.isArray(rows) || rows.length === 0) return rows || [];
            const candidateIds = rows
                .map(c => c?._id || c?.id)
                .filter(Boolean)
                .map(id => String(id));
            if (!candidateIds.length) return rows;

            let atsDocs = [];
            try {
                atsDocs = await conn.models['CandidateATS']
                    .find({ candidate: { $in: candidateIds }, client, isArchived: false })
                    .select('candidate job stageResults createdAt')
                    .populate({
                        path: 'stageResults',
                        select: 'stage stageStatus',
                        populate: {
                            path: 'stage',
                            select: 'title createdAt',
                            match: { isArchived: false }
                        }
                    })
                    .lean()
                    .exec();
            } catch (err) {
                console.error('[CandidateService] Failed to load ATS stage snapshot:', err);
                return rows;
            }

            if (!atsDocs.length) return rows;

            const atsByCandidate = new Map();
            atsDocs.forEach(doc => {
                const key = String(doc.candidate);
                const list = atsByCandidate.get(key) || [];
                list.push(doc);
                atsByCandidate.set(key, list);
            });

            const pickActiveStage = (stageResults) => {
                const cleaned = (stageResults || [])
                    .filter(sr => sr?.stage)
                    .map(sr => ({
                        stage: sr.stage,
                        stageStatus: sr.stageStatus,
                        stageCreatedAt: sr.stage?.createdAt || null,
                    }))
                    .sort((a, b) => {
                        const aTime = a.stageCreatedAt ? new Date(a.stageCreatedAt).getTime() : 0;
                        const bTime = b.stageCreatedAt ? new Date(b.stageCreatedAt).getTime() : 0;
                        return aTime - bTime;
                    });

                if (!cleaned.length) return { label: '', status: '' };

                const active =
                    [...cleaned].reverse().find(sr => String(sr.stageStatus || '').toLowerCase() !== 'not initiated') ||
                    cleaned[0];

                return {
                    label: active?.stage?.title || '',
                    status: active?.stageStatus || '',
                };
            };

            return rows.map(row => {
                const rowId = String(row?._id || row?.id || '');
                if (!rowId) return row;
                const atsList = atsByCandidate.get(rowId) || [];
                if (!atsList.length) return row;

                const primaryJobId = Array.isArray(row.jobs) && row.jobs.length
                    ? String(row.jobs[0])
                    : '';
                let selected = primaryJobId
                    ? atsList.find(ats => String(ats.job) === primaryJobId)
                    : null;
                if (!selected) {
                    selected = [...atsList].sort((a, b) => {
                        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return bTime - aTime;
                    })[0];
                }

                const snapshot = pickActiveStage(selected?.stageResults || []);
                if (!snapshot.label && !snapshot.status) return row;

                return {
                    ...row,
                    currentStage: snapshot.label || row.currentStage,
                    currentStageStatus: snapshot.status || row.currentStageStatus,
                };
            });
        };

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
                        match: { name: 'Created' },
                        populate: {
                            path: 'userId',
                            model: 'User',
                            select: 'firstName lastName email'
                        }
                    }
                });
            }

            let candidates = await conn.models[this.ModelName]
                .find(filter, projection)
                .populate(populates)
                .lean()
                .exec();

            // filter by creator if asked
            if (viewMode === 'me') {
                candidates = candidates.filter(c =>
                    c.eventIds?.some(event =>
                        event?.eventName?.name === 'Created' &&
                        event?.eventName?.userId &&
                        `${event.eventName?.userId?._id || event.eventName?.userId}` === `${user._id}`
                    )
                );
            } else if (viewMode === 'byUser') {
                const uid = String(userId || '').trim();
                if (!uid) {
                    return { ok: false, code: 400, message: 'userId is required for viewMode=byUser' };
                }
                candidates = candidates.filter(c =>
                    c.eventIds?.some(event =>
                        event?.eventName?.name === 'Created' &&
                        event?.eventName?.userId &&
                        `${event?.eventName?.userId?._id || event?.eventName?.userId}` === uid
                    )
                );
            }

            if (limit) {
                candidates = candidates.reverse().slice(0, parseInt(limit) || candidates.length);
            }

            const nameFromUser = (u) =>
                u ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || '—') : '—';

            let items = candidates.map(cand => {
                const createdEv = (cand.eventIds || []).find(e => e?.eventName?.name === 'Created');
                const u = createdEv?.eventName?.userId;
                const uploadedBy = nameFromUser(u);
                cand.eventIds = []; // diet for payload
                return { ...cand, id: cand._id, uploadedBy };
            });

            // if list is used to render grid: flatten skills & jobApplied
            if (viewMode) {
                const jobIds = [...new Set(items.flatMap(c => (c.jobs || []).map(String)))];
                const jDocs = jobIds.length
                    ? await conn.models['Job'].find({ _id: { $in: jobIds } }, 'title internalTitle').lean()
                    : [];
                const jMap = {};
                jDocs.forEach(j => (jMap[j._id] = `${j.title}(${j?.internalTitle})`));

                const skillsToString = a =>
                    Array.isArray(a)
                        ? a.map(s => (typeof s === 'string' ? s : (s && typeof s === 'object') ? Object.keys(s)[0] : ''))
                            .filter(Boolean)
                            .join(', ')
                        : (a ?? '—');

                items = items.map(c => ({
                    ...c,
                    skills: skillsToString(c.skills),
                    jobApplied: (c.jobs || []).map(j => jMap[j] || '—').join(', ')
                }));
            }

            const itemsWithStage = await hydrateStageSnapshot(items);
            return { ok: true, code: 200, message: '', items: itemsWithStage };
        }

        const escapeRegex = (value) =>
            String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const buildRegex = (value, exact = false) => {
            const safe = escapeRegex(value);
            return new RegExp(exact ? `^${safe}$` : safe, 'i');
        };

        const baseMatch = { ...filter };

        const pipeline = [{ $match: baseMatch }];

        const normalizedField = String(filterField || '').trim();
        const normalizedValue = String(filterValue || '').trim();

        if (normalizedField === 'jobApplied' && normalizedValue && normalizedValue !== 'all') {
            if (mongoose.Types.ObjectId.isValid(normalizedValue)) {
                pipeline.push({
                    $match: { jobs: new mongoose.Types.ObjectId(normalizedValue) }
                });
            }
        } else if (normalizedField === 'createdAt' && (dateFrom || dateTo)) {
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
            normalizedField !== 'uploadedBy' &&
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
                    createdByUserId: { $arrayElemAt: ['$createdEventNames.userId', 0] }
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

        if (normalizedField === 'uploadedBy' && normalizedValue && normalizedValue !== 'all') {
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

        pipeline.push(
            {
                $lookup: {
                    from: 'jobs',
                    localField: 'jobs',
                    foreignField: '_id',
                    as: 'jobDocs'
                }
            },
            {
                $addFields: {
                    primaryJobTitle: { $arrayElemAt: ['$jobDocs.title', 0] }
                }
            },
            {
                $addFields: {
                    skillsText: {
                        $reduce: {
                            input: {
                                $let: {
                                    vars: {
                                        skillsArray: {
                                            $cond: [
                                                { $isArray: '$skills' },
                                                '$skills',
                                                {
                                                    $cond: [
                                                        { $eq: [{ $type: '$skills' }, 'string'] },
                                                        ['$skills'],
                                                        []
                                                    ]
                                                }
                                            ]
                                        }
                                    },
                                    in: {
                                        $filter: {
                                            input: {
                                                $map: {
                                                    input: '$$skillsArray',
                                                    as: 's',
                                                    in: {
                                                        $cond: [
                                                            { $eq: [{ $type: '$$s' }, 'string'] },
                                                            '$$s',
                                                            {
                                                                $cond: [
                                                                    { $eq: [{ $type: '$$s' }, 'object'] },
                                                                    {
                                                                        $let: {
                                                                            vars: { kvs: { $objectToArray: '$$s' } },
                                                                            in: {
                                                                                $arrayElemAt: [
                                                                                    {
                                                                                        $map: {
                                                                                            input: '$$kvs',
                                                                                            as: 'kv',
                                                                                            in: '$$kv.k'
                                                                                        }
                                                                                    },
                                                                                    0
                                                                                ]
                                                                            }
                                                                        }
                                                                    },
                                                                    ''
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                }
                                            },
                                            as: 'skill',
                                            cond: { $ne: ['$$skill', ''] }
                                        }
                                    }
                                }
                            },
                            initialValue: '',
                            in: {
                                $cond: [
                                    { $eq: ['$$value', ''] },
                                    '$$this',
                                    { $concat: ['$$value', ', ', '$$this'] }
                                ]
                            }
                        }
                    }
                }
            }
        );

        const searchTerm = String(search || '').trim();
        if (searchTerm) {
            const searchRegex = buildRegex(searchTerm, false);
            pipeline.push({
                $match: {
                    $or: [
                        { firstName: searchRegex },
                        { lastName: searchRegex },
                        { email: searchRegex },
                        { phoneNumber: searchRegex },
                        { createdByName: searchRegex },
                        { createdByEmail: searchRegex },
                        { 'jobDocs.title': searchRegex },
                        { 'jobDocs.internalTitle': searchRegex },
                        { skillsText: searchRegex },
                        { skills: { $elemMatch: { $regex: searchRegex } } }
                    ]
                }
            });
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSizeNum = Math.min(100, parseInt(pageSize, 10) || 10);
        const skip = (pageNum - 1) * pageSizeNum;

        const sortMap = {
            firstName: 'firstName',
            lastName: 'lastName',
            email: 'email',
            phoneNumber: 'phoneNumber',
            jobApplied: 'primaryJobTitle',
            uploadedBy: 'createdByName',
            createdAt: 'createdAt',
            id: '_id'
        };

        const sortField = sortMap[sortBy] || '—';
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
                            createdEventNames: 0
                        }
                    }
                ],
                totalCount: [{ $count: 'count' }]
            }
        });

        const agg = await conn.models[this.ModelName].aggregate(pipeline).exec();
        const rawItems = agg?.[0]?.items || [];
        const total = agg?.[0]?.totalCount?.[0]?.count || 0;

        const nameFromUser = (u) =>
            u ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || '—') : '—';

        const skillsToString = a =>
            Array.isArray(a)
                ? a.map(s => (typeof s === 'string' ? s : (s && typeof s === 'object') ? Object.keys(s)[0] : ''))
                    .filter(Boolean)
                    .join(', ')
                : (a ?? '—');

        const items = rawItems.map(cand => {
            const uploadedBy = cand.createdByName || nameFromUser(cand.createdByDoc) || cand.createdByEmail || '—';
            const jobApplied = (cand.jobDocs || [])
                .map(j => `${j.title}(${j?.internalTitle})`)
                .join(', ');

            return {
                ...cand,
                id: cand._id,
                uploadedBy,
                skills: skillsToString(cand.skills),
                jobApplied,
                eventIds: []
            };
        });

        const meta = {
            total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: pageSizeNum ? Math.ceil(total / pageSizeNum) : 1
        };

        console.log('[CandidateService] getCandidates server-side', {
            page: pageNum,
            pageSize: pageSizeNum,
            total,
            sortBy: sortField,
            sortOrder: sortDir === 1 ? 'asc' : 'desc',
            search: searchTerm ? 'on' : 'off',
            filterField: normalizedField || null,
            viewMode: viewMode || '—'
        });

        const itemsWithStage = await hydrateStageSnapshot(items);
        return { ok: true, code: 200, message: '', items: itemsWithStage, meta };
    }

    // READ
    async getCandidateDetails(payload, user, client, conn) {
        const { id } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return { ok: false, code: 400, message: 'Invalid Candidate ID format' };
        }

        let candidate;
        try {
            candidate = await this.readById(id, { client, user, conn }, 'getEvents' in (payload || {}));
        } catch (err) {
            return { ok: false, code: 400, message: err?.message || '—' };
        }
        if (!candidate) return { ok: false, code: 404, message: 'Candidate not found' };

        // 🔹 Populate Candidate ATS (per job) with stageResults for Application Progress modal
        try {
            const CandidateATS = conn.models['CandidateATS'];
            let applicationsATS = await CandidateATS
                .find({ candidate: id, client, isArchived: false })
                .select('title job stageResults interested aiCallStatus aiCallHangUpCause aiCallHangUpSource resumeUrl currentCtc expectedCtc noticePeriod currentCompany anyOffer location communication callAudioUrl callAudioDuration createdAt updatedAt')
                .populate({
                    path: 'job',
                    select: 'title internalTitle company',
                    populate: { path: 'company', select: 'name' }
                })
                .populate({
                    path: 'stageResults',
                    select: 'stage stageStatus remarkOrFeedback',
                    populate: {
                        path: 'stage',
                        select: 'title description createdAt',
                        match: { isArchived: false }
                    }
                })
                .lean()
                .exec();

            applicationsATS = (applicationsATS || []).map(ats => {
                const stageResults = (ats.stageResults || [])
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

                // Derive createdAt from ObjectId timestamp for documents that pre-date timestamps: true
                if (!ats.createdAt && ats._id) {
                    try { ats.createdAt = ats._id.getTimestamp(); } catch (_) { }
                }

                return { ...ats, stageResults };
            });

            // 🔎 Attach latest video interview score per CandidateATS (if available)
            try {
                const RelevancyRecord = conn.models['RelevancyRecord'];
                const jobIds = applicationsATS
                    .map((ats) => ats?.job?._id || ats?.job)
                    .filter(Boolean);

                if (RelevancyRecord && jobIds.length) {
                    const relevancyRows = await RelevancyRecord.find({
                        client,
                        candidate: id,
                        job: { $in: jobIds },
                        isArchived: false,
                    })
                        .select('job candidateRelevancyToJob updatedAt createdAt')
                        .sort({ updatedAt: -1, createdAt: -1 })
                        .lean()
                        .exec();

                    const relevancyByJobId = new Map();
                    for (const row of relevancyRows || []) {
                        const jobKey = String(row?.job || '');
                        if (!jobKey || relevancyByJobId.has(jobKey)) continue;
                        relevancyByJobId.set(jobKey, row);
                    }

                    applicationsATS = applicationsATS.map((ats) => {
                        const jobKey = String(ats?.job?._id || ats?.job || '');
                        const relevancy = relevancyByJobId.get(jobKey);
                        const relevancyScore = Number(relevancy?.candidateRelevancyToJob);

                        return {
                            ...ats,
                            candidateRelevancyToJob: Number.isFinite(relevancyScore)
                                ? Math.round(relevancyScore)
                                : null,
                            candidateRelevancyToJobUpdatedAt:
                                relevancy?.updatedAt || relevancy?.createdAt || null,
                        };
                    });
                }
            } catch (err) {
                console.warn('[CandidateService] Failed to load relevancy scores:', err?.message || err);
            }

            try {
                const InterviewSchedule = conn.models['InterviewSchedule'];
                const atsIds = applicationsATS.map(ats => ats?._id).filter(Boolean);
                if (InterviewSchedule && atsIds.length) {
                    const schedules = await InterviewSchedule.find({
                        client,
                        candidate: id,
                        candidateATS: { $in: atsIds },
                        isArchived: false,
                    })
                        .select('candidateATS startAt createdAt evaluation')
                        .sort({ startAt: -1, createdAt: -1 })
                        .lean()
                        .exec();

                    const latestByAts = new Map();
                    for (const schedule of schedules || []) {
                        const key = String(schedule?.candidateATS || '');
                        if (!key || latestByAts.has(key)) continue;
                        latestByAts.set(key, schedule);
                    }

                    applicationsATS = applicationsATS.map(ats => {
                        const schedule = latestByAts.get(String(ats._id));
                        const evaluation = schedule?.evaluation || null;
                        const score =
                            typeof evaluation?.totalScore === 'number'
                                ? evaluation.totalScore
                                : typeof evaluation?.score === 'number'
                                    ? evaluation.score
                                    : null;
                        return {
                            ...ats,
                            videoInterviewScore: score,
                            videoInterviewScoreUpdatedAt: schedule?.startAt || schedule?.createdAt || null,
                        };
                    });
                }
            } catch (err) {
                console.warn('[CandidateService] Failed to load video interview scores:', err?.message || err);
            }

            const audioSnapshot = (applicationsATS || []).map(ats => ({
                jobId: ats?.job?._id || ats?.job || null,
                callAudioUrl: ats?.callAudioUrl || null,
                callAudioDuration: ats?.callAudioDuration || null,
            }));
            console.log('[CandidateService] Candidate ATS audio snapshot:', {
                candidateId: id,
                items: audioSnapshot,
            });

            candidate.applicationsATS = applicationsATS;
        } catch (err) {
            console.error('[CandidateService] Failed to load ATS progress for candidate:', err);
            candidate.applicationsATS = [];
        }

        return { ok: true, code: 200, message: '', details: { candidate } };
    }

    // UPDATE (generic)
    async updateCandidate(payload, user, client, conn, updateArchived = false) {
        const { id, ...rest } = payload || {};
        let updated;
        try {
            updated = await this.update(id, rest, { user, client, conn }, false, updateArchived);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return {
                    ok: true,
                    code: 400,
                    message: 'Invalid candidate data',
                    details: Object.values(err.errors).map(e => e.message)
                };
            }
            if (err.name === 'CastError' && err.kind === 'ObjectId') {
                return { ok: true, code: 400, message: 'Invalid candidate ID format' };
            }
            return { ok: true, code: err?.code || 400, message: err?.message || err };
        }
        if (!updated) return { ok: false, code: 404, message: 'Candidate not found' };

        // 🔁 Recompute relevancy for this candidate vs all jobs on normal updates
        if (!updateArchived) {
            try {
                enqueueCandidateRelevancy(updated._id, { conn, client, user });
            } catch (err) {
                console.error('[CandidateService] Failed to enqueue candidate relevancy on update:', err);
            }
        }

        return { ok: true, code: 200, message: '', details: { updated } };
    }

    // ARCHIVE / UNARCHIVE (soft delete)
    async archiveCandidate(payload, user, client, conn) {
        const { id } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return { ok: false, code: 400, message: 'Invalid candidate ID format' };
        }

        try {
            const existed = await this.readById(id, { user, client, conn });
            if (!existed) {
                return { ok: false, code: 404, message: 'Candidate not found' };
            }

            const deleted = await this.delete(id, { user, client, conn });

            if (!deleted) {
                return { ok: false, code: 404, message: 'Candidate not found or already archived' };
            }

            // Also archive associated ATS records for consistency
            try {
                const CandidateATS = conn.models['CandidateATS'];
                if (CandidateATS) {
                    await CandidateATS.updateMany({ candidate: id, client }, { isArchived: true });
                }
            } catch (err) {
                console.warn('[CandidateService] Failed to archive associated ATS records:', err?.message);
            }

            return { ok: true, code: 200, message: '', details: { deleted } };
        } catch (err) {
            return { ok: false, code: 400, message: err?.message || '—' };
        }
    }

    async unarchiveCandidate(payload, user, client, conn) {
        const { id } = payload || {};
        const res = await this.updateCandidate({ id, isArchived: false }, user, client, conn, true);

        if (res?.ok && res?.details?.updated?._id) {
            // Also unarchive associated ATS records
            try {
                const CandidateATS = conn.models['CandidateATS'];
                if (CandidateATS) {
                    await CandidateATS.updateMany({ candidate: id, client }, { isArchived: false });
                }
            } catch (err) {
                console.warn('[CandidateService] Failed to unarchive associated ATS records:', err?.message);
            }

            try {
                enqueueCandidateRelevancy(res.details.updated._id, { conn, client, user });
            } catch (err) {
                console.error('[CandidateService] Failed to enqueue candidate relevancy on unarchive:', err);
            }
        }

        return res;
    }

    // CHECK if a candidate exists but is archived (for distinguishing 404 vs 410)
    async isCandidateArchived(id, client, conn) {
        if (!mongoose.Types.ObjectId.isValid(id)) return false;
        const doc = await conn.models['Candidate']
            .findOne({ _id: id, client, isArchived: true })
            .select('_id')
            .lean()
            .exec();
        return !!doc;
    }

    /* ----------------------------- SPECIAL ENDPOINTS MOVED INTO SERVICE ----------------------------- */

    // POST /upload/ — parse resumes, extract fields + generate embeddings
    async uploadCandidateCVs(req) {
        let resumes = req.body?.resumes ?? [];
        resumes = Array.isArray(resumes) ? resumes : [resumes];

        // Build parallel tasks
        const tasks = resumes.map((dataEle, index) =>
            this.processSingleResume(dataEle, index, req)
        );
        // Execute in parallel
        const results = await Promise.all(tasks);
        // Merge result objects
        const finalOutput = results.reduce((acc, item) => ({ ...acc, ...item }), {});

        return finalOutput;
    }

    // ============================================
    // Parallel Worker: Process Single Resume
    // ============================================
    async processSingleResume(dataEle, index, req) {
        const tag = `[UPLOAD:${index}]`; // log prefix for clean grouping
        // const overallStart = startTimer();
        const filename = dataEle?.filename || `resume-${index}.pdf`;
        const output = {};

        // Robustly extract a JSON object from model output (handles fences/extra text)
        const extractJsonObject = (raw) => {
            if (!raw) return null;

            let s = String(raw).trim();

            // Remove code fences if present
            if (s.startsWith("```")) {
                s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
            }

            // Extract JSON object by braces span
            const firstBrace = s.indexOf("{");
            const lastBrace = s.lastIndexOf("}");
            if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

            return s.slice(firstBrace, lastBrace + 1).trim();
        };

        // Normalize + dedupe skills (case-insensitive). Keep aliasMap SMALL; prompt handles generic normalization.
        const normalizeAndDedupeSkills = (skills) => {
            if (!Array.isArray(skills)) return [];

            const aliasMap = new Map([
                ["nodejs", "Node.js"],
                ["node.js", "Node.js"],
                ["postgres", "PostgreSQL"],
                ["postgresql", "PostgreSQL"],
                ["mongo", "MongoDB"],
                ["mongodb", "MongoDB"],
                ["js", "JavaScript"],
                ["javascript", "JavaScript"],
                ["ts", "TypeScript"],
                ["typescript", "TypeScript"],
            ]);

            const seen = new Set();
            const out = [];

            for (const item of skills) {
                if (typeof item !== "string") continue;

                let x = item.trim();
                if (!x) continue;

                // prevent sentences / overly long strings from leaking in
                if (x.length > 50) continue;

                const key = x.toLowerCase();
                const normalized = aliasMap.get(key) || x;

                const dedupeKey = normalized.toLowerCase();
                if (seen.has(dedupeKey)) continue;

                seen.add(dedupeKey);
                out.push(normalized);
            }

            return out;
        };

        try {
            //const extractStart = startTimer();
            const [extractedText, filePath] = await extractResumeText(
                dataEle._buf,
                filename,
                req
            );
            //logDuration(tag, "resume text extraction", extractStart);

            output[`resumeText of Candidate ${index}`] = extractedText;
            output[`resumeUrl of Candidate ${index}`] = filePath;

            if (!extractedText) {
                console.warn(`${tag} [WARN] No text found in resume. Skipping GPT + Embedding.`);
                return output;
            }

            // ✅ System prompt with HARD RULES to prevent skills leak
            const systemPrompt = `
You are a strict JSON extractor for resumes.

Return ONLY a valid JSON object (no markdown, no commentary) with EXACTLY these keys:
- firstName
- lastName
- email
- countryCode (default "+91")
- phoneNumber
- location (city/location, e.g., "New York" or "Bangalore")
- skills (array of strings)

========================
CRITICAL PREPROCESSING STEP (MANDATORY)
========================

Before extracting ANY skills, you MUST internally classify the resume text into sections
based ONLY on explicit headings.

Valid section headings include (case-insensitive examples):
- Projects
- Summary
- Profile
- Professional Summary
- Experience
- Work Experience
- Employment History
- Work History
- Skills
- Tools
- Technologies

RULES:
- Treat content as belonging to a section ONLY if a clear heading exists.
- Do NOT infer a section from bullet style, placement, or column layout.
- If no heading is found for some content, treat it as Experience by default.
- Sidebar or column layout MUST NOT change section priority.

========================
SECTION FALLBACK + SUMMARY WITHOUT HEADING
========================

SECTION FALLBACK RULE (MANDATORY):
If a required section in the priority order is NOT present
(i.e., no explicit heading exists for that section),
you MUST skip that section and move to the next one.
You MUST NOT infer a missing section from layout, bullets, or tone.

Special case (Summary without heading) (MANDATORY):
If no explicit "Summary" / "Profile" heading exists,
treat ONLY the first continuous paragraph as Summary if ALL are true:
- It appears before any Experience / Work History heading
- It is NOT a bullet list (no leading •, -, *, numbered lines)
- It is at most 3 sentences OR at most 60 words
If these conditions are not met, Summary is missing.

========================
HARD RULES TO EXTRACT SKILLS (MUST FOLLOW)
========================

A) SECTION GATING (STRICT ORDER, NO EXCEPTIONS)

You MUST choose skills ONLY from ONE OR MORE allowed sections following this exact order:

1) Projects section
   - Extract skills ONLY from Projects.
   - If Projects yields >= 4 unique skills → STOP.
   - Do NOT look at any other section.

2) Summary / Profile section
   - Use ONLY if Projects yielded < 4 skills.
   - Add skills ONLY from Summary/Profile text.
   - If total skills >= 4 → STOP.
   - Do NOT use Experience or Skills sections.

3) Experience / Work Experience section
   - Use ONLY if Projects + Summary < 4.
   - Add skills ONLY from Experience text.
   - If total skills >= 4 → STOP.
   - Do NOT use Skills section.

4) Skills / Tools / Technologies section (LAST RESORT ONLY)
   - Use ONLY if total skills < 4 after Experience.
   - Add ONLY the minimum number needed to reach at least 4.
   - If fewer than 4 exist in entire resume, return whatever is available.

========================
STRICT SKILLS SECTION LOCK (MANDATORY)
========================

If you found ANY valid technical skill in Summary or Experience,
you MUST NOT use the Skills / Tools / Technologies section at all,
even if total skills < 4. Return fewer skills.

========================
LOCATION EXTRACTION RULES
========================

Extract location (city/region) from the resume:
- Look for explicit location mentions (e.g., "Based in", "Location:", city name near contact info)
- Check the contact information section first
- Accept city names or regions (e.g., "Bangalore", "New York", "Remote")
- If no explicit location found, leave as null
- Do NOT infer from company location or work experience locations

========================
B) NO SKILL LEAK CHECK (SELF-AUDIT)
========================

For EVERY skill you consider adding:
- The skill MUST appear verbatim as a word or phrase
  in the SAME section you are currently extracting from.
- If you cannot point to the exact phrase in that section,
  DO NOT include the skill.
- Skills found in a later-priority section MUST NOT be used
  if an earlier section already met the stop condition.

PDF SIDEBAR WARNING:
If a Skills section appears near the top (common in two-column resumes),
do NOT use it unless STRICT SKILLS SECTION LOCK allows it.

========================
C) SKILL QUALITY RULES
========================

- Skills must be short labels (1–3 words).
- No duplicates (case-insensitive).
- Exclude generic terms (programming, development, technology, computer science).
- Technical skills only: languages, frameworks, libraries, tools, platforms, databases.
- AI/ML methods ONLY if explicitly mentioned.
- Soft skills ONLY if evidenced by behavior (led, mentored, stakeholders, client-facing).
- Do NOT infer or generalize.

========================
D) NORMALIZATION
========================

- Use standard industry casing when known (React, Next.js, Docker, Kubernetes).
- Expand abbreviations ONLY when unambiguous (JS → JavaScript, TS → TypeScript).
- If unsure, keep exact resume spelling.
- Do NOT invent expansions.

========================
E) OUTPUT
========================

- Return at most 10 skills.
- If the resume contains fewer skills than desired, return fewer without inventing.

========================
F) FINAL VALIDATION (MANDATORY)
========================

Before returning output, internally verify:
- Every skill came from an allowed section.
- Section priority rules were respected.
- Skills section was NOT used if STRICT SKILLS SECTION LOCK triggered.
- Output is valid JSON with no extra text.

If any rule is violated, REMOVE the offending skill.



    `.trim();

            const userPrompt = `
Resume text:
"""
${extractedText}
"""
    `.trim();

            try {
                //const llmStart = startTimer();
                const gptRes = await chatCompletionByOpenAI(
                    [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    req
                );
                //logDuration(tag, "LLM field extraction", llmStart);

                const raw = gptRes?.choices?.[0]?.message?.content || "";
                const jsonStr = extractJsonObject(raw);

                if (!jsonStr) {
                    console.error(`${tag} ❌ GPT Parsing Error: No JSON object found in output`);
                    return output;
                }

                let parsed;
                try {
                    parsed = JSON.parse(jsonStr);
                } catch (e) {
                    console.error(`${tag} ❌ GPT Parsing Error: Invalid JSON`, e);
                    return output;
                }

                output[`firstName of Candidate ${index}`] =
                    typeof parsed.firstName === "string" && parsed.firstName.trim()
                        ? parsed.firstName.trim()
                        : null;

                output[`lastName of Candidate ${index}`] =
                    typeof parsed.lastName === "string" && parsed.lastName.trim()
                        ? parsed.lastName.trim()
                        : null;

                output[`email of Candidate ${index}`] =
                    typeof parsed.email === "string" && parsed.email.trim()
                        ? parsed.email.trim()
                        : null;

                output[`countryCode of Candidate ${index}`] =
                    typeof parsed.countryCode === "string" && parsed.countryCode.trim()
                        ? parsed.countryCode.trim()
                        : "+91";

                output[`phoneNumber of Candidate ${index}`] =
                    typeof parsed.phoneNumber === "string" && parsed.phoneNumber.trim()
                        ? parsed.phoneNumber.trim()
                        : null;

                output[`location of Candidate ${index}`] =
                    typeof parsed.location === "string" && parsed.location.trim()
                        ? parsed.location.trim()
                        : null;

                const skillsArr = normalizeAndDedupeSkills(parsed.skills).slice(0, 25);
                output[`skills of Candidate ${index}`] = skillsArr.join(", ");
            } catch (err) {
                console.error(`${tag} ❌ GPT Parsing Error:`, err);
            }
        } catch (err) {
            console.error(`${tag} [FATAL] Error during processing:`, err);
        }
        // finally {
        //     logDuration(tag, "processSingleResume total", overallStart);
        // }

        return output;
    }

    // POST /multiple/ — bulk create + ATS + Firebase upload mapping
    async createMultipleCandidates(req) {
        let retryUploadedData = {};
        const jobId = req?.body?.jobId;
        const rawTargetStageId = String(req?.body?.targetStageId || req?.query?.targetStageId || '').trim();
        const normalizedTargetStageId = mongoose.Types.ObjectId.isValid(rawTargetStageId)
            ? rawTargetStageId
            : '';
        let bodyUniqueKeys = Object.keys(req?.body || {}).filter(x => x?.includes?.('email'));

        if (bodyUniqueKeys?.length === 0) {
            return retryUploadedData; // caller returns 204 when empty
        }

        for (const [index, _dataEle] of bodyUniqueKeys.entries()) {
            const tmpUploadedData = {};

            const firstName = req?.body?.[`firstName of Candidate ${index}`];
            const lastName = req?.body?.[`lastName of Candidate ${index}`];
            const email = req?.body?.[`email of Candidate ${index}`];
            const countryCode = req?.body?.[`countryCode of Candidate ${index}`];
            const phoneNumber = req?.body?.[`phoneNumber of Candidate ${index}`];
            const location = req?.body?.[`location of Candidate ${index}`];
            const skillsRaw = req.body[`skills of Candidate ${index}`] || '';
            const skillsArr = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
            const skills = skillsArr.map(s => ({ [s]: 1 }));

            const resumeUrl = req?.body?.[`resumeUrl of Candidate ${index}`];
            const resumeText = req?.body?.[`resumeText of Candidate ${index}`];

            const candidateApproved = req?.body?.[`Approved Candidate ${index}`];

            // FIX: use current count of email-keys as new index, without -1
            let newIndx = Object.keys(retryUploadedData || {})
                .filter(x => x?.includes?.('email'))
                ?.length;

            tmpUploadedData[`firstName of Candidate ${newIndx}`] = firstName;
            tmpUploadedData[`lastName of Candidate ${newIndx}`] = lastName;
            tmpUploadedData[`email of Candidate ${newIndx}`] = email;
            tmpUploadedData[`countryCode of Candidate ${newIndx}`] = countryCode;
            tmpUploadedData[`phoneNumber of Candidate ${newIndx}`] = phoneNumber;
            tmpUploadedData[`location of Candidate ${newIndx}`] = location;
            tmpUploadedData[`skills of Candidate ${newIndx}`] = req?.body?.[`skills of Candidate ${index}`];
            tmpUploadedData[`resumeUrl of Candidate ${newIndx}`] = resumeUrl;
            tmpUploadedData[`resumeText of Candidate ${newIndx}`] = resumeText;

            // ============================================
            // 1) Required field validation (unchanged)
            // ============================================
            const missing = [];
            const errors = [];   // <-- FIXED earlier in your version

            if (!firstName) missing.push('First Name');
            if (!lastName) missing.push('Last Name');
            if (!email) missing.push('Email');
            if (!countryCode) missing.push('Country Code');
            if (!phoneNumber) missing.push('Phone Number');
            if (!skills.length) missing.push('Skills');
            if (!resumeUrl) missing.push('Resume Url');
            if (!resumeText) missing.push('Resume Text');
            if (!candidateApproved) missing.push('Candidate Approval');

            if (missing.length) {
                tmpUploadedData["error " + newIndx] = `Missing required field(s): ${missing.join(', ')}`;
                retryUploadedData = { ...retryUploadedData, ...tmpUploadedData };
                continue;
            }

            // ============================================
            // 1.2) Validate job (unchanged)
            // ============================================
            const jobExists = await req.conn.models['Job'].findOne({
                _id: jobId,
                client: req.client
            }).lean();

            if (!jobExists) {
                tmpUploadedData["error " + newIndx] = `Job not found...`;
                retryUploadedData = { ...retryUploadedData, ...tmpUploadedData };
                continue;
            }

            // ============================================
            // 2) Duplicate validation (unchanged)
            // ============================================
            const emailExists = await req.conn.models['Candidate'].findOne({
                email: String(email || '').toLowerCase(),
                client: req.client
            }).lean();
            if (emailExists) errors.push('A candidate with that email already exists.');

            const mobExists = await req.conn.models['Candidate'].findOne({
                phoneNumber,
                client: req.client
            }).lean();
            if (mobExists) errors.push('A candidate with that mobile number already exists.');

            const jobApplied = await req.conn.models['Candidate'].findOne({
                jobs: { $in: [jobId] },
                email: String(email || '').toLowerCase(),
                client: req.client
            }).lean();
            if (jobApplied) errors.push('A candidate already applied for that job with that email...');

            // STOP HERE IF DUPLICATE ERRORS
            if (errors.length > 0) {
                tmpUploadedData["error " + newIndx] = errors.join(', ');
                retryUploadedData = { ...retryUploadedData, ...tmpUploadedData };
                continue;
            }

            // ============================================
            // 3) Skills validation (unchanged)
            // ============================================
            if (!Array.isArray(skills) || skills.length === 0) {
                tmpUploadedData["error " + newIndx] = `At least one skill is required`;
                retryUploadedData = { ...retryUploadedData, ...tmpUploadedData };
                continue;
            }

            // ============================================
            // 4) Create Candidate & ATS (unchanged)
            // ============================================
            let savedCandidate;
            let newCanATS;

            const candidateSaveData = {
                firstName,
                lastName,
                email,
                countryCode,
                phoneNumber,
                location,
                skills,
                jobs: [jobId],
                resumeText
            };

            try {
                savedCandidate = await this.create(candidateSaveData, req);

                let allStages = await this.stageSvc.readAll(req) || [];
                if (allStages?.length <= 0) {
                    let newStage = await req.conn.models['Stage'].findOne({
                        title: "Initial AI Call for Candidate Interest Check",
                        client: req.client
                    }).lean().exec();
                    if (!newStage) {
                        newStage = await this.stageSvc.create(
                            { title: "Initial AI Call for Candidate Interest Check", isArchived: false },
                            req
                        );
                    }
                    allStages = [newStage];
                }

                allStages = [...allStages].sort((a, b) => {
                    const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                    if (aTime !== bTime) return aTime - bTime;
                    return String(a?._id || '').localeCompare(String(b?._id || ''));
                });

                const targetStageIndex = normalizedTargetStageId
                    ? allStages.findIndex((stage) => String(stage?._id || '') === normalizedTargetStageId)
                    : -1;

                let allStageResultIds = [];
                for (const [stageIndex, newStage] of allStages.entries()) {
                    const stageStatus = targetStageIndex >= 0 && stageIndex < targetStageIndex
                        ? 'Completed'
                        : 'Not Initiated';
                    const newStageResultDt = {
                        stage: newStage._id,
                        stageStatus,
                        remarkOrFeedback: '',
                        isArchived: false,
                        client: req.client
                    };

                    let newStageResult = await req.conn.models['StageResult'].findOne(newStageResultDt).lean().exec();
                    if (!newStageResult) {
                        newStageResult = await this.stageResultSvc.create(newStageResultDt, req);
                    }
                    allStageResultIds.push(newStageResult._id);
                }

                const newCanATSDt = {
                    title: "Application #1",
                    candidate: savedCandidate._id,
                    job: jobId,
                    resumeUrl,
                    stageResults: { $in: allStageResultIds },
                };

                newCanATS = await req.conn.models['CandidateATS'].findOne(newCanATSDt).lean().exec();
                if (!newCanATS) {
                    newCanATS = await this.candidateATSSvc.create(
                        { ...newCanATSDt, stageResults: allStageResultIds },
                        req
                    );
                }

                await this.update(savedCandidate._id, { $addToSet: { applications: newCanATS._id } }, req);

                const { _id } = newCanATS;
                const fileBuf = fs.readFileSync(resumeUrl);
                const remotefirbsPath = 'resume_cvs/' + path.basename(resumeUrl);
                await uploadBufferToFirebase(fileBuf, remotefirbsPath);
                const newResumeUrl = await getDownloadURL(remotefirbsPath);

                const candidateUpdateData = { ...candidateSaveData, resumeUrl: newResumeUrl };
                await this.candidateATSSvc.update(_id, candidateUpdateData, req);
            } catch (err) {
                console.error("❌ Candidate (" + firstName + " " + lastName + ") Saving Error: ", err);
                tmpUploadedData["error " + newIndx] = `Invalid candidate data...`;
                retryUploadedData = { ...retryUploadedData, ...tmpUploadedData };
                continue;
            }

            // ============================================
            // Relevancy queue (unchanged)
            // ============================================
            try {
                enqueueCandidateRelevancy(savedCandidate._id, {
                    conn: req.conn,
                    client: req.client,
                    user: req.user
                });
            } catch (err) {
                console.error('[CandidateService] Failed to enqueue candidate relevancy on bulk create:', err);
            }

            try {
                console.log('[CandidateService] Enqueuing candidate embedding after save:', savedCandidate._id);
                enqueueCandidateEmbedding(savedCandidate._id, {
                    conn: req.conn,
                    client: req.client,
                    user: req.user
                });
            } catch (err) {
                console.error('[CandidateService] Failed to enqueue candidate embedding on bulk create:', err);
            }
        }

        if (Object.keys(retryUploadedData)?.length <= 0) {
            retryUploadedData['validated'] = 'successful';
        } else {
            retryUploadedData['validated'] = 'errored';
        }

        return retryUploadedData;
    }

    // GET /tracker/ — Excel export (returns Buffer)
    async generateTrackerExcel(req) {
        let ids = req.query.ids;
        if (!ids) throw new Error('No candidate IDs provided');
        if (Array.isArray(ids)) ids = ids.join(',');
        const validIds = ids.split(',').map(s => s.trim()).filter(mongoose.Types.ObjectId.isValid);
        if (!validIds.length) throw new Error('No valid candidate IDs');

        const jobIdParam = req.query.jobId;
        const selectedJobId = (typeof jobIdParam === 'string' && mongoose.Types.ObjectId.isValid(jobIdParam))
            ? String(jobIdParam)
            : null;

        const candidates = await req.conn.models['Candidate']
            .find({ _id: { $in: validIds } })
            .populate('applications')
            .populate('jobs', 'title')
            .lean();

        const experienceKeys = new Set();
        const ensureExpObj = exp => typeof exp === 'string' ? { total: exp } : (exp || {});

        for (const cand of candidates) {
            const chosenAts = selectedJobId
                ? (cand.applications || []).find(a => String(a.job) === selectedJobId)
                : (cand.applications || [])[0];

            const rawExp = (chosenAts && chosenAts.experience) ?? cand.experience;
            const expObj = ensureExpObj(rawExp);
            Object.keys(expObj).forEach(k => experienceKeys.add(k));
        }

        const minimalCols = [
            { header: 'First Name', key: 'firstName', width: 18 },
            { header: 'Last Name', key: 'lastName', width: 18 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Phone', key: 'phoneNumber', width: 18 },
            // { header: 'PAN', key: 'pan', width: 16 },
            { header: 'Skills', key: 'skills', width: 35 },
        ];
        const expCols = [...experienceKeys]
            .sort((a, b) => a === 'total' ? -1 : b === 'total' ? 1 : a.localeCompare(b))
            .map(k => ({ header: `${k[0].toUpperCase() + k.slice(1)} Experience`, key: `exp_${k}`, width: 16 }));
        const restCols = [
            { header: 'Job Title', key: 'jobTitle', width: 25 },
            { header: 'Current CTC', key: 'currentCtc', width: 14 },
            { header: 'Expected CTC', key: 'expectedCtc', width: 14 },
            { header: 'Company', key: 'currentCompany', width: 20 },
            { header: 'Notice', key: 'noticePeriod', width: 12 },
            { header: 'Any Offer', key: 'anyOffer', width: 10 },
            { header: 'Location', key: 'location', width: 15 },
            { header: 'Interested', key: 'interested', width: 10 },
            { header: 'Comm. Rating', key: 'communication', width: 14 },
            { header: 'Resume URL', key: 'resumeUrl', width: 40 },
            { header: 'Audio URL', key: 'callAudioUrl', width: 60 },
            { header: 'Extra Question Answer', key: 'extraQuestionAnswer', width: 40 },
            { header: 'Transcript', key: 'transcript', width: 60 },
        ];

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Tracker');

        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.columns = [...minimalCols, ...expCols, ...restCols];

        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const flattenSkills = arr =>
            (arr || [])
                .map(o => (typeof o === 'string' ? o : Object.keys(o)[0]))
                .join(', ');

        for (const candidate of candidates) {
            const chosenJob = selectedJobId
                ? (candidate.jobs || []).find(j => String(j._id) === selectedJobId)
                : (candidate.jobs || [])[0];

            const chosenAts = selectedJobId
                ? (candidate.applications || []).find(a => String(a.job) === selectedJobId)
                : (candidate.applications || [])[0];

            const expObj = ensureExpObj((chosenAts && chosenAts.experience) ?? candidate.experience);

            const resumeUrl = `${process?.env?.BACKEND_ORIGIN || "https://hirexit.ai/"}candidates/${candidate._id}/`;
            const audioModalUrl = `${process?.env?.BACKEND_ORIGIN || "https://hirexit.ai/"}candidates/${candidate._id}/?showaudiomodal=true${selectedJobId ? `&jid=${selectedJobId}` : ''}`;
            const transcriptModalUrl = `${process?.env?.BACKEND_ORIGIN || "https://hirexit.ai/"}candidates/${candidate._id}/?showtranscriptmodal=true${selectedJobId ? `&jid=${selectedJobId}` : ''}`;

            const rowData = {
                firstName: req?.query?.candidateFirstName || (candidate.firstName || ''),
                lastName: candidate.lastName || '',
                email: candidate.email || '',
                phoneNumber: candidate.phoneNumber || '',
                // pan: candidate.panCardNumber || '',
                skills: flattenSkills(candidate.skills),
                jobTitle: req?.query?.jobTitle || ((chosenJob && chosenJob.title) || ''),
                currentCtc: (chosenAts && chosenAts.currentCtc) || candidate.currentCtc || '',
                expectedCtc: (chosenAts && chosenAts.expectedCtc) || candidate.expectedCtc || '',
                currentCompany: (chosenAts && chosenAts.currentCompany) || candidate.currentCompany || '',
                noticePeriod: (chosenAts && chosenAts.noticePeriod) || candidate.noticePeriod || '',
                anyOffer: ((chosenAts && chosenAts.anyOffer) ?? candidate.anyOffer) ? 'Yes' : 'No',
                location: (chosenAts && chosenAts.location) || candidate.location || '',
                interested: (chosenAts && chosenAts.interested) || candidate.interested || '—',
                communication: (chosenAts && chosenAts.communication) || candidate.communication || '',
                extraQuestionAnswer: (chosenAts && chosenAts.extraQuestionAnswer) || '',
                resumeUrl,
                callAudioUrl: audioModalUrl,
                transcript: transcriptModalUrl,
            };

            for (const key of experienceKeys) {
                rowData[`exp_${key}`] = expObj[key] || '';
            }

            ws.addRow(rowData);
        }

        const buffer = await wb.xlsx.writeBuffer();
        return buffer;
    }

    // GET /stage-report/ - Stage-wise Excel export (returns Buffer)
    async generateStageWiseReportExcel(req) {
        let ids = req.query.ids;
        if (!ids) throw new Error('No candidate IDs provided');
        if (Array.isArray(ids)) ids = ids.join(',');
        const validIds = [...new Set(
            ids
                .split(',')
                .map((value) => value.trim())
                .filter(mongoose.Types.ObjectId.isValid)
                .map(String)
        )];
        if (!validIds.length) throw new Error('No valid candidate IDs');

        const jobIdParam = req.query.jobId;
        const selectedJobId = (
            typeof jobIdParam === 'string' &&
            mongoose.Types.ObjectId.isValid(jobIdParam)
        ) ? String(jobIdParam) : '';
        if (!selectedJobId) throw new Error('A valid job ID is required');

        let stageIdsQuery = req.query.stageIds;
        if (!stageIdsQuery) throw new Error('No stage IDs provided');
        if (Array.isArray(stageIdsQuery)) stageIdsQuery = stageIdsQuery.join(',');
        const selectedStageIds = [...new Set(
            stageIdsQuery
                .split(',')
                .map((value) => value.trim())
                .filter(mongoose.Types.ObjectId.isValid)
                .map(String)
        )];
        if (!selectedStageIds.length) throw new Error('No valid stage IDs provided');

        const parseDateBoundary = (rawValue, boundary) => {
            const raw = String(rawValue || '').trim();
            if (!raw) return null;

            const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            let year = 0;
            let month = 0;
            let day = 0;

            if (ddmmyyyy) {
                day = Number(ddmmyyyy[1]);
                month = Number(ddmmyyyy[2]);
                year = Number(ddmmyyyy[3]);
            } else if (yyyymmdd) {
                year = Number(yyyymmdd[1]);
                month = Number(yyyymmdd[2]);
                day = Number(yyyymmdd[3]);
            } else {
                throw new Error(`Invalid date format: ${raw}. Use DD/MM/YYYY`);
            }

            const hours = boundary === 'end' ? 23 : 0;
            const minutes = boundary === 'end' ? 59 : 0;
            const seconds = boundary === 'end' ? 59 : 0;
            const millis = boundary === 'end' ? 999 : 0;
            const parsed = new Date(year, month - 1, day, hours, minutes, seconds, millis);
            if (
                Number.isNaN(parsed.getTime()) ||
                parsed.getFullYear() !== year ||
                parsed.getMonth() !== month - 1 ||
                parsed.getDate() !== day
            ) {
                throw new Error(`Invalid date value: ${raw}`);
            }
            return parsed;
        };

        const fromDate = parseDateBoundary(req.query.from, 'start');
        const toDate = parseDateBoundary(req.query.to, 'end');
        if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
            throw new Error('"From" date cannot be after "To" date');
        }

        const stageDocs = await req.conn.models['Stage']
            .find({
                _id: { $in: selectedStageIds },
                client: req.client,
            })
            .select('_id title createdAt')
            .lean();
        const jobDoc = await req.conn.models['Job']
            .findOne({ _id: selectedJobId, client: req.client })
            .select('title internalTitle')
            .lean();
        const reportJobTitle = String(
            jobDoc?.title || jobDoc?.internalTitle || ''
        ).trim();

        const stageById = new Map(
            (stageDocs || []).map((stage) => [String(stage?._id || ''), stage])
        );
        const orderedStageIds = selectedStageIds;

        const atsBaseFilter = {
            candidate: { $in: validIds },
            job: selectedJobId,
            client: req.client,
            isArchived: { $ne: true },
        };
        const buildAtsFilter = (includeDateFilter) => {
            const filter = { ...atsBaseFilter };
            if (includeDateFilter && (fromDate || toDate)) {
                filter.createdAt = {};
                if (fromDate) filter.createdAt.$gte = fromDate;
                if (toDate) filter.createdAt.$lte = toDate;
            }
            return filter;
        };

        const loadAtsRows = async (filter) => req.conn.models['CandidateATS']
            .find(filter)
            .select('candidate stageResults createdAt')
            .populate({
                path: 'candidate',
                select: 'firstName lastName email countryCode phoneNumber mobile',
                options: { lean: true },
            })
            .populate({
                path: 'stageResults',
                select: 'stage stageStatus',
                options: { lean: true },
                populate: {
                    path: 'stage',
                    select: 'title createdAt',
                    options: { lean: true },
                },
            })
            .lean();

        let atsRows = await loadAtsRows(buildAtsFilter(true));
        if (!atsRows.length && (fromDate || toDate)) {
            // Fallback to job + candidate filtered rows if date range yields no matches.
            atsRows = await loadAtsRows(buildAtsFilter(false));
        }

        const candidateRows = await req.conn.models['Candidate']
            .find({ _id: { $in: validIds } })
            .select('_id firstName lastName email countryCode phoneNumber mobile')
            .lean();
        const candidateById = new Map(
            (candidateRows || []).map((row) => [String(row?._id || ''), row])
        );

        const relevancyRows = await req.conn.models['RelevancyRecord']
            .find({
                client: req.client,
                job: selectedJobId,
                candidate: { $in: validIds },
                isArchived: { $ne: true },
            })
            .select('candidate candidateRelevancyToJob')
            .lean();
        const relevancyByCandidateId = new Map(
            (relevancyRows || []).map((row) => [
                String(row?.candidate || ''),
                Number(row?.candidateRelevancyToJob),
            ])
        );

        const atsRowsForReport = (atsRows && atsRows.length)
            ? atsRows
            : validIds.map((candidateId) => ({
                candidate: candidateById.get(String(candidateId)) || String(candidateId),
                stageResults: [],
            }));

        const latestAtsByCandidateId = new Map();
        for (const ats of atsRowsForReport) {
            const candidateId = String(ats?.candidate?._id || ats?.candidate || '');
            if (!candidateId) continue;

            const currentAtsTime = ats?.createdAt
                ? new Date(ats.createdAt).getTime()
                : 0;
            const existingAts = latestAtsByCandidateId.get(candidateId);
            const existingAtsTime = existingAts?.createdAt
                ? new Date(existingAts.createdAt).getTime()
                : 0;

            if (!existingAts || currentAtsTime >= existingAtsTime) {
                latestAtsByCandidateId.set(candidateId, ats);
            }
        }
        const uniqueAtsRows = Array.from(latestAtsByCandidateId.values());

        const rowsByStage = new Map(orderedStageIds.map((stageId) => [stageId, []]));
        for (const ats of uniqueAtsRows) {
            const candidateObj = ats?.candidate && typeof ats.candidate === 'object'
                ? ats.candidate
                : null;
            const candidateId = String(candidateObj?._id || ats?.candidate || '');
            if (!candidateId) continue;

            const candidateInfoFromAts = (
                candidateObj?.firstName ||
                candidateObj?.lastName ||
                candidateObj?.email ||
                candidateObj?.phoneNumber ||
                candidateObj?.mobile
            ) ? candidateObj : null;
            const candidateInfo = candidateInfoFromAts || candidateById.get(candidateId) || null;
            const candidateName = (
                `${candidateInfo?.firstName || ''} ${candidateInfo?.lastName || ''}`
            ).trim() || candidateInfo?.email || `Candidate ${candidateId.slice(-6)}`;
            const email = String(candidateInfo?.email || '').trim();
            const mobileNo = [
                candidateInfo?.countryCode,
                candidateInfo?.phoneNumber || candidateInfo?.mobile || '',
            ]
                .filter(Boolean)
                .join(' ')
                .trim();

            const relevancyScore = Number(relevancyByCandidateId.get(candidateId));
            const relevancePercentage = Number.isFinite(relevancyScore)
                ? `${Math.round(relevancyScore)}%`
                : 'N/A';

            const orderedStageEntries = (ats?.stageResults || [])
                .map((stageResult, index) => ({
                    stageId: String(stageResult?.stage?._id || stageResult?.stage || ''),
                    stageStatus: stageResult?.stageStatus || 'Not Initiated',
                    stageCreatedAt: stageResult?.stage?.createdAt
                        ? new Date(stageResult.stage.createdAt).getTime()
                        : Number.MAX_SAFE_INTEGER,
                    index,
                }))
                .filter((entry) => entry.stageId)
                .sort((a, b) => {
                    if (a.stageCreatedAt !== b.stageCreatedAt) {
                        return a.stageCreatedAt - b.stageCreatedAt;
                    }
                    return a.index - b.index;
                });

            let activeStageEntry = [...orderedStageEntries].reverse().find((entry) => (
                String(entry?.stageStatus || '').toLowerCase() !== 'not initiated'
            ));
            if (!activeStageEntry) {
                activeStageEntry = orderedStageEntries[0] || null;
            }
            if (!activeStageEntry?.stageId) continue;

            const stageRows = rowsByStage.get(activeStageEntry.stageId);
            if (!stageRows) continue;
            stageRows.push({
                candidateName,
                email,
                mobileNo,
                jobTitle: reportJobTitle,
                relevancePercentage,
                stageStatus: activeStageEntry.stageStatus || 'Not Initiated',
            });
        }

        const usedSheetNames = new Set();
        const toWorksheetName = (rawName) => {
            const fallback = 'Stage';
            const base = String(rawName || fallback)
                .replace(/[\\/*?:\[\]]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim() || fallback;
            let next = base.slice(0, 31) || fallback;
            let suffixCounter = 1;

            while (usedSheetNames.has(next.toLowerCase())) {
                const suffix = ` (${suffixCounter})`;
                const prefix = base.slice(0, Math.max(1, 31 - suffix.length)).trim();
                next = `${prefix}${suffix}`;
                suffixCounter += 1;
            }
            usedSheetNames.add(next.toLowerCase());
            return next;
        };

        const workbook = new ExcelJS.Workbook();
        for (const stageId of orderedStageIds) {
            const stage = stageById.get(stageId) || {};
            const fallbackStageTitle = `Stage ${String(stageId).slice(-6)}`;
            const worksheet = workbook.addWorksheet(
                toWorksheetName(stage?.title || fallbackStageTitle)
            );
            worksheet.views = [{ state: 'frozen', ySplit: 1 }];
            worksheet.columns = [
                { header: 'Candidate Name', key: 'candidateName', width: 30 },
                { header: 'Email', key: 'email', width: 32 },
                { header: 'Mobile No', key: 'mobileNo', width: 18 },
                { header: 'Job Title', key: 'jobTitle', width: 28 },
                { header: 'Relevance Percentage', key: 'relevancePercentage', width: 22 },
                { header: 'Stage Status', key: 'stageStatus', width: 20 },
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            const stageRows = rowsByStage.get(stageId) || [];
            stageRows
                .sort((a, b) => String(a.candidateName).localeCompare(String(b.candidateName)))
                .forEach((row) => worksheet.addRow(row));
        }

        return workbook.xlsx.writeBuffer();
    }

    // PUT /:id (multipart) — update + upload resume to Firebase
    async updateCandidateFromMultipart(id, req) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return { ok: false, code: 400, message: 'Invalid Candidate ID format' };
        }
        const resumeValidationMessage = 'Resume details are not appropriate for this candidate. Please upload the candidate\'s own resume.';

        const extractEmails = (text = '') => {
            const matches = String(text || '')
                .toLowerCase()
                .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
            return [...new Set(matches.map(e => e.trim()))];
        };

        const toDigits = (v = '') => String(v || '').replace(/\D/g, '');
        const last10 = (v = '') => {
            const d = toDigits(v);
            return d.length >= 10 ? d.slice(-10) : d;
        };
        const normalizeEmailForMatch = (email = '') => {
            const raw = String(email || '').trim().toLowerCase();
            if (!raw || !raw.includes('@')) return raw;
            let [local, domain] = raw.split('@');
            if (!local || !domain) return raw;
            if (domain === 'googlemail.com') domain = 'gmail.com';
            if (domain === 'gmail.com') {
                local = local.split('+')[0].replace(/\./g, '');
            }
            return `${local}@${domain}`;
        };
        const isFileLike = (v) => {
            if (!v) return false;
            if (Buffer.isBuffer(v)) return true;
            if (Buffer.isBuffer(v?._buf) || Buffer.isBuffer(v?.data)) return true;
            if (Buffer.isBuffer(v?.value?._buf) || Buffer.isBuffer(v?.value?.data)) return true;
            if (typeof v?.toBuffer === 'function' || typeof v?.value?.toBuffer === 'function') return true;
            return v?.type === 'file' || v?.value?.type === 'file';
        };
        const pickFirstFilePart = (payload = {}) => {
            const scan = (x) => {
                if (!x) return null;
                if (Array.isArray(x)) {
                    for (const it of x) {
                        const found = scan(it);
                        if (found) return found;
                    }
                    return null;
                }
                return isFileLike(x) ? x : null;
            };

            const preferred = scan(payload?.resumes);
            if (preferred) return preferred;
            for (const key of Object.keys(payload || {})) {
                const found = scan(payload[key]);
                if (found) return found;
            }
            return null;
        };
        const readFileBuffer = async (part) => {
            if (!part) return null;
            if (Buffer.isBuffer(part)) return part;
            if (Buffer.isBuffer(part?._buf)) return part._buf;
            if (Buffer.isBuffer(part?.data)) return part.data;
            if (Buffer.isBuffer(part?.value?._buf)) return part.value._buf;
            if (Buffer.isBuffer(part?.value?.data)) return part.value.data;
            if (typeof part?.toBuffer === 'function') return await part.toBuffer();
            if (typeof part?.value?.toBuffer === 'function') return await part.value.toBuffer();
            return null;
        };

        let resumes = req.body?.resumes ?? [];
        resumes = Array.isArray(resumes) ? resumes : [resumes];

        let newResumeUrl;
        let extractedResumeText = '';
        const dataEle = resumes[0] || null;
        let hasResumeUpload = false;
        const filePart = pickFirstFilePart(req.body || {});
        const resumeUploadRequested = Boolean(filePart || (req.body && Object.prototype.hasOwnProperty.call(req.body, 'resumes') && req.body.resumes.mimetype !== "text/plain"));
        let resumeBuffer = null;
        try {
            resumeBuffer = await readFileBuffer(filePart || dataEle);
        } catch (err) {
            console.error('[CandidateService] Failed to read resume file buffer during multipart update:', err);
        }

        if (resumeUploadRequested && !(resumeBuffer && resumeBuffer.length > 0)) {
            return { ok: false, code: 400, message: resumeValidationMessage };
        }

        if (resumeBuffer && (resumeBuffer || [])?.length > 0) {
            hasResumeUpload = true;
            const defaultFileName = filePart?.filename || filePart?.value?.filename || dataEle?.filename || dataEle?.value?.filename || `resume-0`;
            const extIn = (path.extname(defaultFileName) || "").toLowerCase();
            const resumeName = `tmpResume_${defaultFileName.replace(/\W+/g, '_')}${extIn || ".pdf"}`;
            try {
                const [resumeTextFromUpload] = await extractResumeText(
                    resumeBuffer,
                    defaultFileName,
                    req
                );
                if (typeof resumeTextFromUpload === 'string' && resumeTextFromUpload.trim()) {
                    extractedResumeText = resumeTextFromUpload.trim();
                }
            } catch (err) {
                console.error('[CandidateService] Resume text extraction failed during multipart update:', err);
            }

            if (!extractedResumeText) {
                return {
                    ok: false,
                    code: 400,
                    message: resumeValidationMessage
                };
            }

            const existingCandidate = await req.conn.models['Candidate']
                .findOne({ _id: id, client: req.client, isArchived: false })
                .select('firstName lastName email phoneNumber countryCode')
                .lean();

            if (!existingCandidate) {
                return { ok: false, code: 404, message: 'Candidate not found' };
            }

            const resumeEmails = extractEmails(extractedResumeText).map(normalizeEmailForMatch);
            const candidateEmail = normalizeEmailForMatch(existingCandidate?.email || '');
            const emailMatched = !!(candidateEmail && resumeEmails.includes(candidateEmail));

            const resumeDigits = toDigits(extractedResumeText);
            const candidatePhone = toDigits(existingCandidate?.phoneNumber || '');
            const candidatePhoneWithCountry = toDigits(`${existingCandidate?.countryCode || ''}${existingCandidate?.phoneNumber || ''}`);
            const candidatePhoneLast10 = last10(existingCandidate?.phoneNumber || '');
            const phoneMatched = Boolean(
                (candidatePhone && resumeDigits.includes(candidatePhone)) ||
                (candidatePhoneWithCountry && resumeDigits.includes(candidatePhoneWithCountry)) ||
                (candidatePhoneLast10 && resumeDigits.includes(candidatePhoneLast10))
            );

            if (!emailMatched || !phoneMatched) {
                return {
                    ok: false,
                    code: 400,
                    message: resumeValidationMessage
                };
            }

            const remotefirbsPath = 'resume_cvs/' + resumeName;
            await uploadBufferToFirebase(resumeBuffer, remotefirbsPath);
            newResumeUrl = await getDownloadURL(remotefirbsPath);
        }

        let updated;
        try {
            let data = {
                ...req.body,
                ...(newResumeUrl ? { resumeUrl: newResumeUrl } : {}),
                ...(extractedResumeText ? { resumeText: extractedResumeText } : {})
            };

            Object.keys(data).forEach(ele => {
                if (typeof data[ele] === "object") {
                    if (data[ele]?.type === "file") data[ele] = undefined;
                    data[ele] = data[ele]?.value;
                }
            });

            if (typeof data.skills === 'string') {
                data.skills = data.skills
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(s => ({ [s]: 1 }));
            }

            const candidateModel = req?.conn?.models?.Candidate;
            if (candidateModel) {
                const normalizedEmail = typeof data.email === 'string'
                    ? data.email.trim().toLowerCase()
                    : '';
                if (normalizedEmail) {
                    const emailExists = await candidateModel
                        .findOne({ email: normalizedEmail, client: req.client, _id: { $ne: id } })
                        .lean();
                    if (emailExists) {
                        return { ok: false, code: 409, message: 'A candidate with that email already exists.' };
                    }
                    data.email = normalizedEmail;
                }

                const normalizedPhone = data.phoneNumber == null
                    ? ''
                    : String(data.phoneNumber).trim();
                if (normalizedPhone) {
                    const phoneExists = await candidateModel
                        .findOne({ phoneNumber: normalizedPhone, client: req.client, _id: { $ne: id } })
                        .lean();
                    if (phoneExists) {
                        return { ok: false, code: 409, message: 'A candidate with that mobile number already exists.' };
                    }
                }
            }

            updated = await this.update(id, data, req, true);
            if (updated) updated.eventIds = undefined;

        } catch (err) {
            if (err.name === 'ValidationError') {
                return {
                    ok: false,
                    code: 400,
                    message: 'Invalid candidate data',
                    details: Object.values(err.errors).map(e => e.message)
                };
            }
            if (hasResumeUpload) {
                return { ok: false, code: 400, message: resumeValidationMessage };
            }
            return { ok: false, code: 500, message: 'Server error while updating candidate' };
        }

        if (!updated) {
            return { ok: false, code: 404, message: 'Candidate not found' };
        }

        // 🔁 Recompute relevancy when resume / profile updated via multipart
        try {
            enqueueCandidateRelevancy(updated._id, {
                conn: req.conn,
                client: req.client,
                user: req.user
            });
        } catch (err) {
            console.error('[CandidateService] Failed to enqueue candidate relevancy on multipart update:', err);
        }

        return { ok: true, code: 200, details: { updated } };
    }

    /* ---------------------------------------------------------
    VECTOR SEARCH (Service Layer) — Reusable + Clean Logging
    ------------------------------------------------------------ */
    async runVectorCandidateSearch(query, req, limit = 50) {
        console.log("\n=============== [VECTOR] SERVICE START ===============");
        console.log("[VECTOR] Query:", query);

        if (!query || typeof query !== "string") {
            console.log("[VECTOR][ERROR] Missing or invalid query");
            return { ok: false, error: "Query is required", stage: "input_validation" };
        }

        try {
            /* ---------------------------------------------------
               1. Generate embedding
            ---------------------------------------------------- */
            console.log("[VECTOR] Generating embedding...");
            const embedding = await generateEmbedding(query, req);

            if (!embedding || !Array.isArray(embedding)) {
                console.log("[VECTOR][ERROR] Embedding failed. Value:", embedding);
                return { ok: false, error: "Embedding generation failed", stage: "embedding" };
            }

            console.log("[VECTOR] ✔ Embedding generated, length =", embedding.length);

            /* ---------------------------------------------------
               2. Run MongoDB vector search
            ---------------------------------------------------- */
            console.log("[VECTOR] Running MongoDB vector search...");

            const start = Date.now();
            let vectorResults = [];
            let vectorErr = null;

            try {
                vectorResults = await req.conn.models['Candidate'].aggregate([
                    {
                        $vectorSearch: {
                            index: "vector_index",
                            path: "embedding",
                            queryVector: embedding,
                            numCandidates: 500,
                            limit: limit
                        }
                    },
                    {
                        $project: {
                            firstName: 1,
                            lastName: 1,
                            email: 1,
                            skills: 1,
                            score: { $meta: "vectorSearchScore" }
                        }
                    },
                ]);
            } catch (err) {
                vectorErr = err;
                console.error("[VECTOR][ERROR] MongoDB vector search failed:", err.message);
            }

            const duration = Date.now() - start;
            console.log(`[VECTOR] Vector search execution time: ${duration}ms`);
            console.log(`[VECTOR] Returned candidates: ${vectorResults.length}`);

            if (vectorErr) {
                return {
                    ok: false,
                    error: vectorErr?.message || "Vector search failure",
                    stage: "vector_search"
                };
            }

            if (vectorResults.length === 0) {
                console.warn("[VECTOR] No candidates returned.");
                return {
                    ok: true,
                    items: [],
                    message: "No candidates matched.",
                    meta: { query, limit }
                };
            }

            /* ---------------------------------------------------
               3. Lightweight response shaping
            ---------------------------------------------------- */
            const items = vectorResults.map((c) => {
                let flatSkills = [];
                if (Array.isArray(c.skills)) {
                    flatSkills = c.skills.map(s => {
                        if (typeof s === "string") return s;
                        if (typeof s === "object") return Object.keys(s)[0];
                        return null;
                    }).filter(Boolean);
                }

                return {
                    candidateId: c._id,
                    fullName: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
                    email: c.email || "",
                    skills: flatSkills,
                    vectorScore: c.score
                };

            });

            /* ---------------------------------------------------
               4. Optional LLM Re-Ranking
            ---------------------------------------------------- */
            const ENABLE_LLM_RERANKING = true;
            if (ENABLE_LLM_RERANKING) {
                console.log("[VECTOR][RERANK] Starting LLM reranking...");

                try {
                    // Limit to top 5 to avoid context overflow
                    const rerankCandidates = items.slice(0, 15);

                    const rankingPrompt = `
                        You are an expert technical recruiter. Rank the following candidates for the query:
                        "${query}"

                        Consider:
                        - Skill match
                        - Job fit
                        - Experience relevance~
                        - Role-specific expectations

                        Return ONLY a JSON array:
                        [
                        { "index": 0, "score": 95, "reason": "…" }
                        ]
                        `.trim();

                    console.log("[VECTOR][RERANK] Prompt prepared.");
                    console.log("[VECTOR][RERANK] Sending", rerankCandidates.length, "candidates to LLM...");

                    const llmResponse = await chatCompletionByOpenAI(
                        [
                            { role: "system", content: "You are an expert recruiter performing semantic candidate ranking." },
                            { role: "user", content: rankingPrompt },
                            { role: "user", content: "Candidates:\n" + JSON.stringify(rerankCandidates, null, 2) }
                        ],
                        req,
                        0,
                        null,
                        "gpt-4.1-mini"
                    );

                    const raw = llmResponse?.choices?.[0]?.message?.content || "";
                    console.log("[VECTOR][RERANK] Raw LLM output (truncated):", raw.slice(0, 500), "...");

                    let aiRanks = [];
                    try {
                        aiRanks = JSON.parse(raw);
                    } catch (err) {
                        console.error("[VECTOR][RERANK][ERROR] Failed to parse LLM JSON:", raw.slice(0, 300));
                        return {
                            ok: true,
                            items,
                            meta: { query, limit, reranking: false }
                        };
                    }

                    console.log("[VECTOR][RERANK] Parsed rerank list:", aiRanks);

                    const reranked = aiRanks
                        .map(r => {
                            const original = rerankCandidates[r.index];
                            if (!original) return null;
                            return {
                                ...original,
                                aiScore: r.score,
                                aiReason: r.reason || "No reason provided"
                            };
                        })
                        .filter(Boolean)
                        .sort((a, b) => b.aiScore - a.aiScore);

                    console.log("[VECTOR][RERANK] Final reranked count:", reranked.length);

                    return {
                        ok: true,
                        items: reranked,
                        meta: { query, limit, reranking: true }
                    };

                } catch (err) {
                    console.error("[VECTOR][RERANK][FATAL ERROR]", err);
                    return {
                        ok: true,
                        items,
                        meta: { query, limit, reranking: false }
                    };
                }
            }

            console.log("[VECTOR] ✔ Processed items:", items.length);
            console.log("=============== [VECTOR] SERVICE END ===============\n");

            return {
                ok: true,
                items,
                meta: { query, limit }
            };

        } catch (err) {
            console.error("[VECTOR][FATAL ERROR]", err);
            return {
                ok: false,
                error: err?.message || "Unknown error",
                stage: "fatal"
            };
        }
    }

    // POST /assign-job — assign jobs + build ATS + stages
    async assignJobsToCandidates(body, req) {
        const { candidateIds = [], jobIds = [], targetStageId = '' } = body || {};
        if (!candidateIds.length || !jobIds.length) {
            return { ok: false, code: 400, message: 'candidateIds & jobIds are required' };
        }

        const Cand = req.conn.models['Candidate'];

        const validCids = candidateIds.filter(mongoose.Types.ObjectId.isValid);
        const validJids = jobIds.filter(mongoose.Types.ObjectId.isValid);
        const normalizedTargetStageId = String(targetStageId || '').trim();
        if (!validCids.length) return { ok: false, code: 400, message: 'No valid candidate IDs' };
        if (!validJids.length) return { ok: false, code: 400, message: 'No valid job IDs' };
        if (normalizedTargetStageId && !mongoose.Types.ObjectId.isValid(normalizedTargetStageId)) {
            return { ok: false, code: 400, message: 'Invalid target stage ID' };
        }

        const docs = await Cand.find(
            { _id: { $in: validCids }, client: req.client },
            { jobs: 1 },
        ).lean();

        const toUpdate = [];
        const skipped = [];
        docs.forEach(d => {
            const alreadyHas = validJids.every(j => d.jobs.map(String).includes(j));
            (alreadyHas ? skipped : toUpdate).push(String(d._id));
        });

        // ✅ Updated message to what you asked for
        if (!toUpdate.length)
            return { ok: false, code: 409, message: 'Candidate is already applied for this job', skipped };

        let allStages = await this.stageSvc.readAll(req) || [];
        if (allStages?.length <= 0) {
            let newStage = await req.conn.models['Stage'].findOne({ title: "Initial AI Call for Candidate Interest Check", client: req.client }).lean().exec();
            if (!newStage) {
                newStage = await this.stageSvc.create({ title: "Initial AI Call for Candidate Interest Check", isArchived: false }, req);
            }
            allStages = [newStage];
        }

        allStages = [...allStages].sort((a, b) => {
            const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (aTime !== bTime) return aTime - bTime;
            return String(a?._id || '').localeCompare(String(b?._id || ''));
        });

        const targetStageIndex = normalizedTargetStageId
            ? allStages.findIndex((stage) => String(stage?._id || '') === normalizedTargetStageId)
            : -1;
        if (normalizedTargetStageId && targetStageIndex < 0) {
            return { ok: false, code: 400, message: 'Target stage not found' };
        }

        const bulk = toUpdate.map(cid => ({
            updateOne: {
                filter: { _id: cid, client: req.client },
                update: { $addToSet: { jobs: { $each: validJids } } },
            },
        }));
        await Cand.bulkWrite(bulk);

        for (const savedCandidate of toUpdate) {
            let allStageResultIds = [];
            for (const [stageIndex, newStage] of allStages.entries()) {
                const stageStatus = targetStageIndex >= 0 && stageIndex < targetStageIndex
                    ? 'Completed'
                    : 'Not Initiated';
                const newStageResultDt = { stage: newStage._id, stageStatus, remarkOrFeedback: '', isArchived: false, client: req.client };
                let newStageResult = await req.conn.models['StageResult'].findOne(newStageResultDt).lean().exec();
                if (!newStageResult) {
                    newStageResult = await this.stageResultSvc.create(newStageResultDt, req);
                }
                allStageResultIds.push(newStageResult._id);
            }

            let allCanATS = [];
            for (const jobId of validJids) {
                const newCanATSDt = {
                    title: "Application #1",
                    candidate: savedCandidate,
                    job: jobId,
                    stageResults: { $in: allStageResultIds },
                };

                let newCanATS = await req.conn.models['CandidateATS'].findOne(newCanATSDt).lean().exec();
                if (!newCanATS) {
                    newCanATS = await this.candidateATSSvc.create({ ...newCanATSDt, stageResults: allStageResultIds }, req);
                }
                allCanATS.push(newCanATS._id);
            }

            await this.update(savedCandidate, { $addToSet: { applications: { $each: allCanATS } } }, req);

            // 🔁 Candidate got new jobs; recompute relevancy vs all jobs
            try {
                enqueueCandidateRelevancy(savedCandidate, {
                    conn: req.conn,
                    client: req.client,
                    user: req.user
                });
            } catch (err) {
                console.error('[CandidateService] Failed to enqueue candidate relevancy on assignJobs:', err);
            }
        }

        return { ok: true, code: 200, success: true, updated: bulk.length, skipped };
    }
}
