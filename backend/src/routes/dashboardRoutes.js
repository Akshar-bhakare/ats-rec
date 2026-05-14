import fs from 'fs';
import ExcelJS from 'exceljs';
import { parse as parseDate, isValid as isValidDate } from 'date-fns';
import CandidateService from '../services/candidateService.js';
import JobService from '../services/jobService.js';
import { getRequestTimeZone, localDateTimeToUtc } from '../utils/timeUtils.js';

export default async function dashboardRoutes(fastify) {
    // secure all endpoints
    fastify.addHook('preHandler', fastify.authenticate);

    const candidateSvc = new CandidateService();
    const jobSvc = new JobService();

    // Helper: aggregate companies by 'Created' event's userId
    async function getCompanyCountsByCreatedEvent(conn, clientId, dateFilter) {
        const matchStage = { client: clientId, isArchived: { $ne: true } };

        return conn.models['Company'].aggregate([
            { $match: matchStage },
            { $unwind: '$eventIds' },
            {
                $lookup: {
                    from: 'events',
                    localField: 'eventIds',
                    foreignField: '_id',
                    as: 'evt'
                }
            },
            { $unwind: '$evt' },
            {
                $lookup: {
                    from: 'eventnames',
                    localField: 'evt.eventName',
                    foreignField: '_id',
                    as: 'ename'
                }
            },
            { $unwind: '$ename' },
            {
                $match: {
                    'ename.name': 'Created',
                    'evt.isArchived': { $ne: true },
                    ...(dateFilter ? { 'evt.eventAt': dateFilter } : {})
                }
            },
            // Deduplicate company/user pairs
            { $group: { _id: { company: '$_id', user: '$ename.userId' } } },
            { $group: { _id: '$_id.user', companies: { $sum: 1 } } }
        ]);
    }

    const getStageCounts = (recId, cand, candidateStageRec) => {

        cand?.applications?.forEach?.((apl) => {
            apl?.stageResults?.forEach?.((stgRes) => {
                if (!(recId in candidateStageRec)) {
                    candidateStageRec[recId] = {
                        [stgRes.stage.title]: 0
                    }
                }
                candidateStageRec[recId][stgRes.stage.title] = (candidateStageRec?.[recId]?.[stgRes.stage.title] || 0) + 1;
            });
        });

        return candidateStageRec;
    }


    const getDashboardStats = async (req, dateFilter = undefined, givenRecruiters = undefined, givenCandidates = undefined) => {
        try {
            const { client } = req;
            const recruiters = givenRecruiters ?? await req.conn.models['User']
                .find({ client, role: { $in: ['recruiter', 'manager', 'client_admin'] }, isArchived: false }, '_id email firstName lastName role')
                .lean();

            const recruiterMap = recruiters.reduce((acc, r) => {
                acc[r._id.toString()] = {
                    recruiterId: r._id,
                    email: r.email,
                    firstName: r.firstName,
                    lastName: r.lastName,
                    role: r.role,
                    companies: 0,
                    candidates: 0,
                    jobs: 0,
                };
                return acc;
            }, {});

            let jbFilter = {};

            if (client) jbFilter.client = client;
            if (dateFilter) jbFilter.createdAt = dateFilter;
            jbFilter.isArchived = false;
            const jobCounts = await req.conn.models['Job'].aggregate([
                { $match: jbFilter },
                { $group: { _id: '$createdBy', jobs: { $sum: 1 } } },
            ]);
            jobCounts.forEach(({ _id, jobs }) => {
                const key = _id?.toString();
                if (key && recruiterMap[key]) recruiterMap[key].jobs = jobs;
            });

            const compCounts = await getCompanyCountsByCreatedEvent(req.conn, client, dateFilter);
            compCounts.forEach(({ _id, companies }) => {
                const key = _id?.toString();
                if (key && recruiterMap[key]) recruiterMap[key].companies = companies;
            });

            const candidates = givenCandidates ?? await req.conn.models['Candidate']
                .find({ client, isArchived: false })
                .select('applications eventIds')
                .populate({
                    path: 'applications',
                    model: "CandidateATS",
                    select: 'stageResults',
                    populate: {
                        path: 'stageResults',
                        model: "StageResult",
                        select: 'stage stageStatus',
                        match: { stageStatus: { $in: [/select/i, /completed/i] } },
                        populate: {
                            path: "stage",
                            model: "Stage",
                            select: "title"
                        },
                    },
                })
                .populate({
                    path: 'eventIds',
                    select: 'eventName eventAt',
                    populate: {
                        path: 'eventName',
                        select: 'name userId',
                    },
                })
                .lean();

            let candidateStageRec = {};
            const candidateByRec = {};
            candidates.forEach(cand => {
                (cand.eventIds || []).forEach(e => {
                    const evName = e.eventName?.name;
                    const rid = e.eventName?.userId;
                    const evtTime = new Date(e.eventAt);
                    if (evName === 'Created' && rid) {
                        if (dateFilter) {
                            if (!(evtTime >= dateFilter?.$gte && evtTime <= dateFilter?.$lte)) {
                                return;
                            }
                        }
                        const key = rid.toString();
                        candidateByRec[key] = (candidateByRec[key] || 0) + 1;

                        let candidateStageRec1 = getStageCounts(rid, cand, candidateStageRec);

                        candidateStageRec = {
                            ...candidateStageRec,
                            ...candidateStageRec1,
                        }

                    }
                });
            });
            Object.entries(candidateByRec).forEach(([rid, cnt]) => {
                if (recruiterMap[rid]) recruiterMap[rid].candidates = cnt;
            });

            Object.entries(candidateStageRec).forEach(([rid, stgs]) => {

                Object.entries(stgs).forEach(([stage, cnt]) => {

                    if (recruiterMap[rid]) {
                        recruiterMap[rid][stage] = cnt;
                    } else if (!givenRecruiters) {
                        // only create new entries (like client_admin) when we did NOT pass a specific recruiter list
                        recruiterMap[rid] = {
                            [stage]: cnt
                        }
                    }

                });

            });

            let dt = Object.values(recruiterMap);

            return dt;

        } catch (err) {
            console.log('[getDashboardStats] ❌ ERROR in POST /stats:', err);
            return 'Failed to fetch recruiter stats; ' + err.message;
        }
    }


    fastify.get('/stats', async (req, reply) => {
        try {
            let dt = await getDashboardStats(req);

            return reply.send(dt);

        } catch (err) {
            console.log('[dashboard/stats] ❌ ERROR in GET /stats:', err);
            return reply.code(400).send({ error: 'Failed to fetch recruiter stats', details: err.message });
        }
    });

    fastify.post('/stats', async (req, reply) => {
        const { from, to } = req.body;

        if (!from || !to) {
            return reply.code(400).send({ error: "Missing required 'from' or 'to'" });
        }

        const dateFrom = new Date(from);
        if (isNaN(dateFrom.getTime())) {
            return reply.code(400).send({ error: "Invalid 'from' date format. Expect 'YYYY-MM-DD'" });
        }
        const dateToRaw = new Date(to);
        if (isNaN(dateToRaw.getTime())) {
            return reply.code(400).send({ error: "Invalid 'to' date format. Expect 'YYYY-MM-DD'" });
        }
        dateToRaw.setHours(23, 59, 59, 999);
        const dateFilter = { $gte: dateFrom, $lte: dateToRaw };

        try {

            return reply.send(await getDashboardStats(req, dateFilter));

        } catch (err) {
            console.log('[dashboard/stats] ❌ ERROR in POST /stats:', err);
            return reply.code(400).send({ error: 'Failed to fetch recruiter stats', details: err.message });
        }
    });

    // NEW: consolidated dashboard overview (stats + AI minutes + recruiter totals)
    fastify.get('/overview', async (req, reply) => {
        const { subjectUserId, from, to } = req.query || {};
        let dateFilter;

        if (from && to) {
            const dateFrom = new Date(from);
            if (isNaN(dateFrom.getTime())) {
                return reply.code(400).send({ error: "Invalid 'from' date format. Expect 'YYYY-MM-DD'" });
            }
            const dateToRaw = new Date(to);
            if (isNaN(dateToRaw.getTime())) {
                return reply.code(400).send({ error: "Invalid 'to' date format. Expect 'YYYY-MM-DD'" });
            }
            dateToRaw.setHours(23, 59, 59, 999);
            dateFilter = { $gte: dateFrom, $lte: dateToRaw };
        }

        try {
            const payload = {};

            // recruiterTotals (my candidates / jobs) when a subjectUserId is provided
            if (subjectUserId) {
                const subjectIdStr = String(subjectUserId).trim();
                const currentUserId = req.user?._id ? String(req.user._id) : null;
                const viewMode = currentUserId && currentUserId === subjectIdStr ? 'me' : 'byUser';

                const [candRes, jobRes] = await Promise.all([
                    candidateSvc.getCandidates({ viewMode, userId: subjectIdStr }, req.user, req.client, req.conn),
                    jobSvc.getJobs({ viewMode, userId: subjectIdStr }, req.user, req.client, req.conn)
                ]);

                const candCount = Array.isArray(candRes?.items) ? candRes.items.length : 0;
                const jobCount = Array.isArray(jobRes?.items) ? jobRes.items.length : 0;

                payload.recruiterTotals = {
                    candidates: candCount,
                    jobs: jobCount
                };
            }

            // recruiter stats / client-admin stats
            const stats = await getDashboardStats(req, dateFilter);
            payload.adminRecruiterStats = Array.isArray(stats) ? stats : [];

            // total AI call minutes (sum of durationSeconds for this client's DB)
            const Conversation = req.conn.models['Conversation'];
            const match = {};
            if (dateFilter) {
                match.$or = [
                    { createdAt: dateFilter },
                    { updatedAt: dateFilter }
                ];
            }

            const pipeline = [];
            if (Object.keys(match).length) {
                pipeline.push({ $match: match });
            }
            pipeline.push({
                $group: {
                    _id: null,
                    totalSeconds: { $sum: { $ifNull: ['$durationSeconds', 0] } }
                }
            });

            const agg = await Conversation.aggregate(pipeline).exec();
            const totalSeconds = agg?.[0]?.totalSeconds || 0;
            payload.totalAiCallMinutes = Math.round(totalSeconds / 60);

            if (!subjectUserId) {
                const requestTimeZone = getRequestTimeZone(req);
                const todayLocal = new Date().toLocaleDateString('en-CA', {
                    timeZone: requestTimeZone
                });
                let todayStartUtc = localDateTimeToUtc(
                    todayLocal,
                    '00:00:00',
                    requestTimeZone,
                );
                let todayEndUtc = localDateTimeToUtc(
                    todayLocal,
                    '23:59:59',
                    requestTimeZone,
                );

                if (Number.isNaN(todayStartUtc.getTime())) {
                    const now = new Date();
                    todayStartUtc = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate(),
                        0,
                        0,
                        0,
                        0,
                    );
                }
                if (Number.isNaN(todayEndUtc.getTime())) {
                    const now = new Date();
                    todayEndUtc = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate(),
                        23,
                        59,
                        59,
                        999,
                    );
                }

                const Job = req.conn.models['Job'];
                const CandidateATS = req.conn.models['CandidateATS'];
                const InterviewSchedule = req.conn.models['InterviewSchedule'];

                const activeJobDocs = await Job.find({
                    client: req.client,
                    status: 'active',
                    isArchived: { $ne: true }
                })
                    .select('title internalTitle company createdBy')
                    .populate({ path: 'company', select: 'name' })
                    .lean();

                const jobIds = activeJobDocs.map(job => job._id);
                const candidateCounts = jobIds.length
                    ? await CandidateATS.aggregate([
                        {
                            $match: {
                                client: req.client,
                                isArchived: { $ne: true },
                                job: { $in: jobIds }
                            }
                        },
                        { $group: { _id: '$job', candidates: { $sum: 1 } } },
                    ])
                    : [];

                const countMap = new Map(
                    candidateCounts.map(item => [
                        String(item._id),
                        item.candidates
                    ]),
                );

                payload.activeJobs = activeJobDocs
                    .map(job => ({
                        id: job._id,
                        title: job.internalTitle || job.title,
                        company: job.company?.name || 'Unknown',
                        candidates: countMap.get(String(job._id)) || 0,
                        createdBy: job.createdBy,
                    }))
                    .sort((a, b) => (b.candidates || 0) - (a.candidates || 0));

                payload.activeJobsTotal = activeJobDocs.length;

                const stuckCutoffDays = 7;
                const stuckCutoff = new Date();
                stuckCutoff.setDate(stuckCutoff.getDate() - stuckCutoffDays);

                const candidateAtsDocs = await CandidateATS.find({
                    client: req.client,
                    isArchived: { $ne: true },
                })
                    .select('candidate job stageResults')
                    .populate({
                        path: 'candidate',
                        select: 'firstName lastName createdAt',
                        match: {
                            isArchived: { $ne: true },
                            createdAt: { $lte: stuckCutoff }
                        },
                    })
                    .populate({
                        path: 'job',
                        select: 'title internalTitle company',
                        populate: { path: 'company', select: 'name' },
                    })
                    .populate({
                        path: 'stageResults',
                        select: 'stage stageStatus',
                        populate: { path: 'stage', select: 'title' },
                    })
                    .lean();

                const stuckCandidates = candidateAtsDocs
                    .map(doc => {
                        if (!doc?.candidate || !doc?.job) return null;

                        const stageRes = (doc.stageResults || []).find(
                            sr =>
                                sr &&
                                ['On Hold', 'Not Initiated'].includes(
                                    sr.stageStatus,
                                ),
                        );
                        if (!stageRes) return null;

                        const createdAt = doc.candidate?.createdAt
                            ? new Date(doc.candidate.createdAt)
                            : null;
                        if (!createdAt || Number.isNaN(createdAt.getTime())) {
                            return null;
                        }

                        const daysInPipeline = Math.floor(
                            (Date.now() - createdAt.getTime()) /
                            (1000 * 60 * 60 * 24),
                        );

                        const candidateName = [
                            doc.candidate.firstName,
                            doc.candidate.lastName,
                        ]
                            .filter(Boolean)
                            .join(' ')
                            .trim() || 'Candidate';

                        return {
                            candidateId: doc.candidate._id,
                            name: candidateName,
                            jobTitle: doc.job.internalTitle || doc.job.title,
                            company: doc.job.company?.name || '',
                            stage: stageRes.stage?.title || '',
                            stageStatus: stageRes.stageStatus,
                            daysInPipeline,
                        };
                    })
                    .filter(item => item && item.daysInPipeline >= stuckCutoffDays)
                    .sort((a, b) => b.daysInPipeline - a.daysInPipeline)
                    .slice(0, 5);

                payload.stuckCandidates = stuckCandidates;

                if (InterviewSchedule) {
                    const pendingMatch = {
                        client: req.client,
                        isArchived: { $ne: true },
                        startAt: { $gte: todayStartUtc, $lte: todayEndUtc },
                        endedAt: null,
                        completedAt: null,
                        interviewStatus: {
                            $not: /complete|cancel|miss|unattend/i
                        },
                    };
                    const pendingCount =
                        await InterviewSchedule.countDocuments(pendingMatch);
                    const pendingDocs = await InterviewSchedule.find(pendingMatch)
                        .sort({ startAt: 1 })
                        .limit(5)
                        .populate({
                            path: 'candidate',
                            select: 'firstName lastName',
                        })
                        .populate({
                            path: 'job',
                            select: 'title internalTitle company',
                            populate: { path: 'company', select: 'name' },
                        })
                        .lean();

                    payload.pendingInterviews = pendingDocs.map(doc => {
                        const startAt = doc?.startAt
                            ? new Date(doc.startAt)
                            : null;
                        const timeLabel =
                            startAt && !Number.isNaN(startAt.getTime())
                                ? startAt.toLocaleTimeString('en-US', {
                                    timeZone: requestTimeZone,
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })
                                : 'TBD';

                        const candidateName = [
                            doc.candidate?.firstName,
                            doc.candidate?.lastName,
                        ]
                            .filter(Boolean)
                            .join(' ')
                            .trim() || 'Candidate';

                        return {
                            id: doc._id,
                            candidateName,
                            jobTitle:
                                doc.job?.internalTitle ||
                                doc.job?.title ||
                                'Interview',
                            company: doc.job?.company?.name || '',
                            startAt: doc.startAt,
                            timeLabel,
                        };
                    });
                    payload.pendingInterviewsTotal = pendingCount;

                    const interviewMatch = {
                        client: req.client,
                        isArchived: { $ne: true },
                    };
                    if (dateFilter) {
                        interviewMatch.startAt = dateFilter;
                    }

                    payload.totalInterviews =
                        await InterviewSchedule.countDocuments(interviewMatch);

                    const interviewAgg = await InterviewSchedule.aggregate([
                        { $match: interviewMatch },
                        {
                            $lookup: {
                                from: 'jobs',
                                localField: 'job',
                                foreignField: '_id',
                                as: 'jobDoc',
                            },
                        },
                        { $unwind: '$jobDoc' },
                        {
                            $group: {
                                _id: '$jobDoc.createdBy',
                                interviews: { $sum: 1 },
                            },
                        },
                    ]);

                    payload.interviewCountsByRecruiter = interviewAgg.map(
                        row => ({
                            recruiterId: row._id,
                            interviews: row.interviews || 0,
                        }),
                    );
                } else {
                    payload.pendingInterviews = [];
                    payload.pendingInterviewsTotal = 0;
                    payload.totalInterviews = 0;
                    payload.interviewCountsByRecruiter = [];
                }
            }

            return reply.send(payload);
        } catch (err) {
            console.log('[dashboard/overview] ❌ ERROR in GET /overview:', err);
            return reply.code(400).send({ error: 'Failed to fetch dashboard overview', details: err.message });
        }
    });

    fastify.get('/recruiter-report', async (req, reply) => {
        try {
            const { client } = req;
            const { from, to, summaryFields } = req.query;
            const reportRole = String(req.query?.role || 'recruiter').trim().toLowerCase();
            const roleLabel = reportRole === 'manager' ? 'Manager' : 'Recruiter';
            const roleLabelPlural = `${roleLabel}s`;

            if (!['recruiter', 'manager'].includes(reportRole)) {
                return reply.code(400).send({ error: 'role must be either recruiter or manager' });
            }

            if (!from || !to) {
                return reply.code(400).send({ error: 'from & to dates are required (dd/MM/yyyy)' });
            }

            // parse selected summary fields (for summary sheet only)
            let selectedSummaryKeySet = null;
            if (typeof summaryFields === 'string' && summaryFields.trim()) {
                const keys = summaryFields
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                if (keys.length) {
                    selectedSummaryKeySet = new Set(keys);
                }
            }

            const d1 = parseDate(from, 'dd/MM/yyyy', new Date());
            const d2 = parseDate(to, 'dd/MM/yyyy', new Date());
            if (!isValidDate(d1) || !isValidDate(d2)) {
                return reply.code(400).send({ error: 'Invalid date format – use dd/MM/yyyy' });
            }
            const start = new Date(d1.setHours(0, 0, 0, 0));
            const end = new Date(d2.setHours(23, 59, 59, 999));
            const dateFilter = { $gte: start, $lte: end };

            const User = req.conn.models['User'];
            const recruiters = await User.find(
                { client, role: reportRole, isArchived: false },
                { firstName: 1, lastName: 1, email: 1 }
            ).lean();
            if (!recruiters.length) {
                return reply.code(404).send({ error: `No ${reportRole}s found for this client` });
            }

            const stagesDocs = await req.conn.models['Stage'].find({
                client,
            })
                .select("title")
                .lean();

            const allStageNames = stagesDocs?.map?.(ele => ele.title);

            const Candidate = req.conn.models['Candidate'];
            const candDocs = await Candidate.find(
                { client, createdAt: dateFilter },
                {
                    firstName: 1, lastName: 1, email: 1,
                    phoneNumber: 1, skills: 1,
                    eventIds: 1, jobs: 1,
                    stageName: 1, stageStatus: 1
                }
            )
                .populate({
                    path: 'applications',
                    model: "CandidateATS",
                    select: 'stageResults',
                    populate: {
                        path: 'stageResults',
                        model: "StageResult",
                        select: 'stage stageStatus',
                        match: { stageStatus: { $in: [/select/i, /completed/i] } },
                        populate: {
                            path: "stage",
                            model: "Stage",
                            select: "title"
                        },
                    },
                })
                .populate({
                    path: 'eventIds',
                    select: 'eventAt eventName',
                    populate: {
                        path: 'eventName',
                        model: 'EventName',
                        select: 'name userId',
                        match: { name: 'Created' }
                    }
                })
                .populate({
                    path: 'jobs',
                    select: 'title company',
                    populate: { path: 'company', select: 'name' }
                })
                .lean();

            const dashboardStats = await getDashboardStats(req, dateFilter, recruiters, candDocs)

            const getCreatorId = c =>
                c.eventIds?.find(e => e.eventName?.name === 'Created')
                    ?.eventName?.userId?.toString() || '';

            const byRec = candDocs.reduce((acc, c) => {
                const rid = getCreatorId(c);
                if (!acc[rid]) acc[rid] = [];
                acc[rid].push(c);
                return acc;
            }, {});

            const wb = new ExcelJS.Workbook();
            const flattenSkills = arr =>
                (arr || []).map(s => typeof s === 'string' ? s : Object.keys(s)[0]).join(', ');

            // Role-wise count (SUMMARY SHEET)
            const recSummSheet = wb.addWorksheet(`${roleLabelPlural} Summary`);

            recSummSheet.views = [
                { state: 'frozen', ySplit: 1 }
            ];

            // base summary columns
            const baseSummaryCols = [
                { header: 'First Name', key: 'firstName', width: 25 },
                { header: 'Last Name', key: 'lastName', width: 25 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Company(s) Created', key: 'companies', width: 18 },
                { header: 'Job(s) Created', key: 'jobs', width: 18 },
                { header: 'Candidate(s) Uploaded', key: 'candidates', width: 18 },
            ];

            const allSummaryColumns = [];

            baseSummaryCols.forEach(col => {
                allSummaryColumns.push(col);
            });

            allStageNames?.forEach?.(stgName => {
                allSummaryColumns.push({
                    header: stgName,
                    key: stgName,
                    width: 18,
                });
            });

            let finalSummaryColumns = allSummaryColumns;

            if (selectedSummaryKeySet) {
                const filtered = allSummaryColumns.filter(col => selectedSummaryKeySet.has(col.key));
                if (filtered.length) {
                    finalSummaryColumns = filtered;
                }
            }

            recSummSheet.columns = finalSummaryColumns;

            const headerRow = recSummSheet.getRow(1);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            const allowedSummaryKeys = new Set(finalSummaryColumns.map(col => col.key));

            dashboardStats?.forEach?.(dsSt => {
                const rowDt = {};
                allowedSummaryKeys.forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(dsSt, key)) {
                        rowDt[key] = dsSt[key];
                    }
                });
                recSummSheet.addRow(rowDt);
            });

            // Recruiter wise candidates (DETAIL SHEETS – with Date column)
            recruiters.forEach((r, index) => {
                const rId = r._id.toString();
                const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email;
                const sheetName = `${index + 1} ${name}`; // <-- unique worksheet name
                const sheet = wb.addWorksheet(sheetName);

                sheet.views = [
                    { state: 'frozen', ySplit: 1 }
                ];

                const colsArr = [
                    { header: 'First Name', key: 'firstName', width: 18 },
                    { header: 'Last Name', key: 'lastName', width: 18 },
                    { header: 'Email', key: 'email', width: 28 },
                    { header: 'Phone', key: 'phoneNumber', width: 18 },
                    { header: 'Date', key: 'createdDate', width: 18 },
                    { header: 'Job Applied', key: 'jobTitle', width: 25 },
                    { header: 'Company', key: 'companyName', width: 25 },
                    { header: 'Skills', key: 'skills', width: 40 },
                ]

                allStageNames?.forEach?.(stgName => {
                    colsArr.push({
                        header: stgName,
                        key: stgName,
                        width: 18,
                    })
                })

                sheet.columns = colsArr;

                const headerRow2 = sheet.getRow(1);
                headerRow2.eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });

                const rows = byRec[rId] || [];
                rows.forEach(candRow => {
                    const job = Array.isArray(candRow.jobs) && candRow.jobs.length ? candRow.jobs[0] : {};

                    // derive created date from Created event (eventIds[0].eventAt), format DD/MM/YYYY
                    let createdDate = '';
                    const createdEvent = Array.isArray(candRow.eventIds) ? candRow.eventIds[0] : null;
                    if (createdEvent?.eventAt) {
                        const d = new Date(createdEvent.eventAt);
                        if (!Number.isNaN(d.getTime())) {
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            createdDate = `${day}/${month}/${year}`;
                        }
                    }

                    const rowDt = {
                        firstName: candRow.firstName,
                        lastName: candRow.lastName,
                        email: candRow.email,
                        phoneNumber: candRow.phoneNumber || '',
                        createdDate,
                        jobTitle: job.title || '',
                        companyName: job.company?.name || '',
                        skills: flattenSkills(candRow.skills),
                    };


                    candRow?.applications?.forEach?.((apl) => {
                        apl?.stageResults?.forEach?.((stgRes) => {
                            rowDt[stgRes.stage.title] = "Yes"
                        });
                    });

                    sheet.addRow(rowDt);
                });
            });

            const buffer = await wb.xlsx.writeBuffer();
            const filename = `${reportRole}_report_${from.replace(/\//g, '-')}_to_${to.replace(/\//g, '-')}.xlsx`;

            reply
                .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                .header('Content-Disposition', `attachment; filename="${filename}"`)
                .header('Content-Length', buffer.byteLength)
                .send(buffer);

        } catch (err) {
            console.log('[Rpt] ❌ error generating recruiter report', err);
            reply.code(400).send({ error: 'Failed to generate report', details: err.message });
        }
    });
}
