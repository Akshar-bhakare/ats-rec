import InterviewScheduleService from '../../services/VirtualInterview/interviewScheduleService.js';
import { generateInterviewReportPdf } from '../../services/VirtualInterview/interviewReportPdf.js';
import mongoose from 'mongoose';
import { registerNewInterviewReminder, deleteReminderTimeout } from '../../../SystemChecksAndInitiators/interviewReminderScheduler.js';
import { uploadBufferToFirebase, getDownloadURL } from '../../utils/firebaseUtils.js';

const isCodingInterviewSchedule = (schedule) => {
    const roundType = String(schedule?.roundType || '').trim().toLowerCase();
    const interviewType = String(schedule?.interviewType || '').trim().toLowerCase();
    return roundType.includes('coding') || interviewType.includes('coding');
};

export default async function interviewScheduleRoutes(fastify) {
    const svc = new InterviewScheduleService();

    fastify.addHook('preHandler', fastify.authenticate);

    // Create interview schedule (combine date/time fields)
    fastify.post('/', async (req, reply) => {
        const res = await svc.createWithCombine(req.body, req);

        // Register a 30-min reminder timeout for the new schedule immediately
        if (res?.ok && res?.item) {
            registerNewInterviewReminder(res.item, req.dbName, req).catch((err) => {
                console.log('[InterviewScheduleRoutes] ⚠️  registerNewInterviewReminder failed (non-blocking):', err?.message);
            });
        }

        return reply
            .code(res?.code || (res?.ok ? 201 : 400))
            .send(res?.ok ? res.item : { error: res?.message });
    });

    // List all for client or for a specific ATS (?candidateATS=...)
    fastify.get('/', async (req, reply) => {
        const res = await svc.listByATS(req?.query || {}, req);
        if (res?.meta) {
            return reply.code(res?.code || 200).send(res);
        }
        return reply.code(res?.code || 200).send(res.items || []);
    });

    // List archived interviews
    fastify.get('/archived', async (req, reply) => {
        const res = await svc.listByATS({ ...(req?.query || {}), archived: true }, req);
        if (res?.meta) {
            return reply.code(res?.code || 200).send(res);
        }
        return reply.code(res?.code || 200).send(res.items || []);
    });

    // Consolidated init view
    fastify.get('/view', async (req, reply) => {
        const res = await svc.getInitView(
            {
                candidateATS: req.query?.candidateATS,
                candidateId: req.query?.candidateId,
                jobId: req.query?.jobId,
            },
            req
        );

        return reply.code(res?.code || 200).send(res?.ok ? res.data : { error: res?.message });
    });

    // Script for WebRTC
    fastify.get('/script', async (req, reply) => {
        const res = await svc.getScriptByCandidateAndJob(
            {
                candidateId: req.query?.candidateId,
                jobId: req.query?.jobId,
                scheduleId: req.query?.sid,
                accessToken: req.query?.token || req.query?.accessToken
            },
            req
        );
        return reply.code(res?.code || 200).send(res?.ok ? res.data : { error: res?.message });
    });

    // Consume WebRTC token after explicit consent (single-use)
    fastify.post('/consume-token', async (req, reply) => {
        const res = await svc.consumeWebrtcToken(
            {
                candidateId: req.body?.candidateId,
                jobId: req.body?.jobId,
                accessToken: req.body?.token || req.body?.accessToken
            },
            req
        );
        return reply
            .code(res?.code || (res?.ok ? 200 : 400))
            .send(res?.ok ? (res.item || { ok: true }) : { error: res?.message });
    });

    // Latest video for (candidateId + jobId)
    fastify.get('/latest-video', async (req, reply) => {
        const { candidateId, jobId } = req.query || {};

        console.log("[VIDEO][latest-video] Request", {
            client: req.client,
            candidateId,
            jobId,
        });

        if (!candidateId || !jobId) {
            console.warn("[VIDEO][latest-video] Missing candidateId/jobId", { candidateId, jobId });
            return reply.code(400).send({ ok: false, error: 'candidateId and jobId are required' });
        }

        if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
            console.warn("[VIDEO][latest-video] Invalid ObjectId(s)", { candidateId, jobId });
            return reply.code(400).send({ ok: false, error: 'Invalid candidateId or jobId' });
        }

        const InterviewSchedule = req.conn.models['InterviewSchedule'];

        const latest = await InterviewSchedule.findOne({
            client: req.client,
            candidate: new mongoose.Types.ObjectId(candidateId),
            job: new mongoose.Types.ObjectId(jobId),
            isArchived: false,
        })
            .sort({ startAt: -1, createdAt: -1 })
            .select('_id startAt videoRecordingUrl')
            .lean()
            .exec();

        console.log("[VIDEO][latest-video] DB result", {
            found: !!latest,
            scheduleId: latest?._id?.toString() || null,
            startAt: latest?.startAt || null,
            hasVideoUrl: !!latest?.videoRecordingUrl,
            videoUrlDomain: latest?.videoRecordingUrl ? (() => {
                try { return new URL(latest.videoRecordingUrl).host; } catch { return "invalid-url"; }
            })() : null,
        });

        return reply.send({
            ok: true,
            scheduleId: latest?._id || null,
            startAt: latest?.startAt || null,
            url: latest?.videoRecordingUrl || null,
        });
    });

    // Transcript for a specific interview schedule (best-effort matching)
    fastify.get('/:id/transcript', async (req, reply) => {
        try {
            const InterviewSchedule = req.conn.models['InterviewSchedule'];
            const Conversation = req.conn.models['Conversation'];

            const schedule = await InterviewSchedule.findOne({
                _id: req.params.id,
                client: req.client,
            })
                .select('candidate job interviewType interviewerType')
                .lean()
                .exec();

            if (!schedule) return reply.code(404).send({ error: 'Interview not found' });
            if (!Conversation) return reply.send({ conversation: null });

            const interviewType = schedule?.interviewType || 'Technical';
            const interviewerType = schedule?.interviewerType || 'AI';
            const candidateId = schedule.candidate;
            const jobId = schedule.job;
            const scheduleId = schedule._id;
            const baseCallUUID = `webrtc_${jobId}_${candidateId}`;
            const scheduleCallUUID = `webrtc_${jobId}_${candidateId}_${scheduleId}`;

            const filters = [
                {
                    key: 'schedule+type',
                    filter: {
                        client: req.client,
                        interviewScheduleId: scheduleId,
                        candidateId,
                        jobId,
                        interviewType,
                        interviewerType,
                        isArchived: false,
                    }
                },
                {
                    key: 'schedule-only',
                    filter: {
                        client: req.client,
                        interviewScheduleId: scheduleId,
                        candidateId,
                        jobId,
                        isArchived: false,
                    }
                },
                {
                    key: 'schedule+callUUID',
                    filter: {
                        client: req.client,
                        interviewScheduleId: scheduleId,
                        candidateId,
                        jobId,
                        callUUID: scheduleCallUUID,
                        isArchived: false,
                    }
                },
                {
                    key: 'candidate+job+type',
                    filter: {
                        client: req.client,
                        candidateId,
                        jobId,
                        interviewType,
                        interviewerType,
                        isArchived: false,
                    }
                },
                {
                    key: 'candidate+job+callUUID',
                    filter: {
                        client: req.client,
                        candidateId,
                        jobId,
                        callUUID: baseCallUUID,
                        isArchived: false,
                    }
                },
                {
                    key: 'candidate+job',
                    filter: {
                        client: req.client,
                        candidateId,
                        jobId,
                        isArchived: false,
                    }
                },
            ];

            let conversation = null;
            for (const entry of filters) {
                conversation = await Conversation.findOne(entry.filter)
                    .sort({ createdAt: -1 })
                    .lean()
                    .exec();
                if (conversation?.messages?.length) {
                    console.log('[TRANSCRIPT] Conversation matched', {
                        scheduleId: scheduleId?.toString(),
                        match: entry.key,
                        messages: conversation.messages.length,
                        conversationId: conversation._id?.toString() || null,
                    });
                    break;
                }
            }

            if (!conversation) {
                console.warn('[TRANSCRIPT] No conversation found for schedule', {
                    scheduleId: scheduleId?.toString(),
                    candidateId: candidateId?.toString(),
                    jobId: jobId?.toString(),
                });
            }

            return reply.send({ conversation: conversation || null });
        } catch (err) {
            fastify.log.warn({ err }, 'Failed to load transcript');
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: err?.message || 'Failed to load transcript',
            });
        }
    });

    // Reactivate / reshare WebRTC link (Virtual interviews only)
    fastify.post('/:id/activate-link', async (req, reply) => {
        const res = await svc.activateWebrtcLink(req.params.id, req);
        return reply.code(res?.code || (res?.ok ? 200 : 400)).send(res?.ok ? res.item : { error: res?.message });
    });
    fastify.post('/:id/activate-reshare', async (req, reply) => {
        const hours = req?.body?.activeWindowHours;
        const scheduleStartAt = req?.body?.scheduleStartAt || null;
        const res = await svc.activateAndReshareLink(req.params.id, req, hours, scheduleStartAt);

        if (res?.ok && res?.item) {
            // Clear any existing reminder timeout for this schedule (old startAt)
            deleteReminderTimeout(`reminder_${req.params.id}`);
            // Register a fresh timeout for the updated startAt
            registerNewInterviewReminder(res.item, req.dbName, req).catch((err) => {
                console.log('[InterviewScheduleRoutes] ⚠️ registerNewInterviewReminder failed after activate-reshare:', err?.message);
            });
        }

        return reply.code(res?.code || (res?.ok ? 200 : 400)).send(res?.ok ? res.item : { error: res?.message });
    });

    // Get interviews assigned to the current user (for interviewers)
    fastify.get('/my', async (req, reply) => {
        const userId = req.user?.sub;
        if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(50, parseInt(req.query.pageSize) || 10);

        const InterviewSchedule = req.conn.models['InterviewSchedule'];
        const filter = {
            client: req.client,
            interviewers: new mongoose.Types.ObjectId(userId),
            isArchived: false,
        };

        const [total, items] = await Promise.all([
            InterviewSchedule.countDocuments(filter),
            InterviewSchedule.find(filter)
                .sort({ startAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .populate('candidate', 'firstName lastName email')
                .populate({ path: 'job', select: 'title internalTitle', populate: { path: 'company', select: 'name' } })
                .lean(),
        ]);

        return reply.send({
            ok: true,
            items,
            meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
        });
    });

    // Submit interviewer feedback for an interview
    fastify.put('/:id/feedback', async (req, reply) => {
        const userId = req.user?.sub;
        if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

        const InterviewSchedule = req.conn.models['InterviewSchedule'];
        const schedule = await InterviewSchedule.findOne({
            _id: req.params.id,
            client: req.client,
            isArchived: false,
        }).lean();

        if (!schedule) return reply.code(404).send({ error: 'Interview not found' });

        const isAssigned = (schedule.interviewers || []).some(
            (uid) => uid.toString() === userId.toString()
        );
        if (!isAssigned) {
            return reply.code(403).send({ error: 'You are not assigned to this interview' });
        }

        const { rating, recommendation, strengths, improvements, overallComment, parameterRatings } = req.body || {};

        const sanitizedParamRatings = Array.isArray(parameterRatings)
            ? parameterRatings
                .filter(p => p && String(p.skill || '').trim())
                .map(p => ({
                    skill: String(p.skill).trim(),
                    rating: typeof p.rating === 'number' ? Math.min(5, Math.max(0, Math.round(p.rating))) : 0,
                    comment: String(p.comment || '').trim(),
                }))
            : [];

        const feedback = {
            rating: typeof rating === 'number' ? Math.min(5, Math.max(1, Math.round(rating))) : null,
            recommendation: recommendation || null,
            strengths: String(strengths || '').trim(),
            improvements: String(improvements || '').trim(),
            overallComment: String(overallComment || '').trim(),
            parameterRatings: sanitizedParamRatings,
            submittedAt: new Date(),
            submittedBy: new mongoose.Types.ObjectId(userId),
        };

        const updated = await InterviewSchedule.findByIdAndUpdate(
            req.params.id,
            { $set: { interviewerFeedback: feedback } },
            { new: true }
        ).lean();

        return reply.send({ ok: true, item: updated });
    });

    // Get interviewer's saved feedback parameter template
    fastify.get('/interviewer-preference', async (req, reply) => {
        const userId = req.user?.sub;
        if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
        const InterviewerPreference = req.conn.models['InterviewerPreference'];
        const pref = await InterviewerPreference.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            client: req.client,
        }).lean();
        return reply.send({ parameters: pref?.feedbackParameters || [] });
    });

    // Save interviewer's feedback parameter template for future use
    fastify.put('/interviewer-preference', async (req, reply) => {
        const userId = req.user?.sub;
        if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
        const { parameters } = req.body || {};
        const skills = (Array.isArray(parameters) ? parameters : [])
            .map(s => String(s).trim())
            .filter(Boolean);
        const InterviewerPreference = req.conn.models['InterviewerPreference'];
        await InterviewerPreference.findOneAndUpdate(
            { userId: new mongoose.Types.ObjectId(userId), client: req.client },
            { $set: { feedbackParameters: skills } },
            { upsert: true, new: true }
        );
        return reply.send({ ok: true });
    });

    // Read one
    fastify.get('/:id', async (req, reply) => {
        let item = await svc.readById(req.params.id, req);
        if (!item) return reply.code(404).send({ error: 'Not found' });

        item = await svc.refreshStatusIfNeeded(item, req);

        console.log("[VIDEO][schedule-read] GET /api/interviewschedules/:id", {
            scheduleId: req.params.id,
            hasVideoUrl: !!item?.videoRecordingUrl,
            videoUrlDomain: item?.videoRecordingUrl ? (() => {
                try { return new URL(item.videoRecordingUrl).host; } catch { return "invalid-url"; }
            })() : null,
        });

        return reply.send(item);
    });

    // Generate & download interview report PDF
    fastify.get('/:id/report', async (req, reply) => {
        try {
            const InterviewSchedule = req.conn.models['InterviewSchedule'];
            const Conversation = req.conn.models['Conversation'];

            const schedule = await InterviewSchedule.findOne({
                _id: req.params.id,
                client: req.client,
            })
                .populate([
                    { path: 'candidate', select: 'firstName lastName email' },
                    {
                        path: 'job',
                        select: 'title internalTitle description company primarySkills',
                        populate: { path: 'company', select: 'name' },
                    },
                ])
                .lean()
                .exec();

            if (!schedule) return reply.code(404).send({ error: 'Interview not found' });

            // ✅ Fetch final submission for coding rounds
            let finalSubmission = null;
            if (isCodingInterviewSchedule(schedule)) {
                try {
                    const Submission = req.conn.models['Submission'];
                    const SubmissionResult = req.conn.models['SubmissionResult'];
                    const TestCase = req.conn.models['TestCase'];

                    if (Submission) {
                        const candidateObjId = schedule?.candidate?._id || null;
                        const candidateQueryOptions = [];
                        if (candidateObjId) {
                            candidateQueryOptions.push({ userId: candidateObjId });
                        }
                        // fallback exactly like InterviewDetail retry without userId
                        candidateQueryOptions.push(null);

                        const findSubmission = async ({ finalOnly }) => {
                            for (const candidateOpt of candidateQueryOptions) {
                                const baseFilter = {
                                    interviewId: schedule._id,
                                    ...(candidateOpt || {}),
                                };

                                const query = finalOnly
                                    ? {
                                        ...baseFilter,
                                        isFinalSubmission: true,
                                    }
                                    : {
                                        ...baseFilter,
                                        status: { $nin: ['queued', 'running'] },
                                    };

                                const found = await Submission.findOne(query)
                                    .sort(finalOnly ? { createdAt: -1 } : { passedTestCases: -1, createdAt: -1 })
                                    .populate('problemId', 'title difficulty description constraints')
                                    .populate('language', 'name')
                                    .lean();

                                if (found) return found;
                            }
                            return null;
                        };

                        let submission = await findSubmission({ finalOnly: true });
                        if (!submission) {
                            submission = await findSubmission({ finalOnly: false });
                        }

                        if (submission) {
                            // Fetch submission results (test case details)
                            let results = [];
                            if (SubmissionResult) {
                                results = await SubmissionResult.find({ submissionId: submission._id })
                                    .populate('testCaseId', 'order input expectedOutput isSample')
                                    .sort({ 'testCaseId.order': 1 })
                                    .lean();
                            }

                            // Fetch all test cases for the problem (for complete test case info)
                            let allTestCases = [];
                            if (TestCase && submission.problemId?._id) {
                                allTestCases = await TestCase.find({ problemId: submission.problemId._id })
                                    .sort({ order: 1 })
                                    .lean();
                            }

                            finalSubmission = {
                                ...submission,
                                results,
                                allTestCases
                            };
                        }
                    }
                } catch (err) {
                    fastify.log.warn({ err }, 'Failed to load coding submission; continuing without it');
                }
            }

            // latest schedule for same candidate+job (latest video)
            const latest = await InterviewSchedule.findOne({
                client: req.client,
                candidate: schedule.candidate?._id,
                job: schedule.job?._id,
                isArchived: false,
            })
                .sort({ startAt: -1, createdAt: -1 })
                .select('_id startAt interviewType interviewerType videoRecordingUrl webrtcLink meetingLink')
                .lean()
                .exec();

            const latestVideoUrl = latest?.videoRecordingUrl || null;

            console.log("[VIDEO][report] Latest schedule lookup for video", {
                reportScheduleId: req.params.id,
                latestScheduleId: latest?._id?.toString() || null,
                latestStartAt: latest?.startAt || null,
                hasLatestVideoUrl: !!latestVideoUrl,
                latestVideoUrlDomain: latestVideoUrl ? (() => {
                    try { return new URL(latestVideoUrl).host; } catch { return "invalid-url"; }
                })() : null,
            });

            const scheduleRp = schedule?.remoteProctoring || null;
            const latestRp = latest?.remoteProctoring || null;
            const rp = scheduleRp || latestRp || null;
            const rpReasonCounts = rp?.reasonCounts || {};
            const rpViolationCount =
                typeof rp?.violationCount === "number" ? rp.violationCount : null;
            const rpTabsEvents =
                (rpReasonCounts.TAB_HIDDEN || 0) + (rpReasonCounts.WINDOW_BLUR || 0);
            const rpCameraEvents =
                (rpReasonCounts.CAMERA_TOGGLE_BLOCKED || 0) +
                (rpReasonCounts.CAMERA_TRACK_ENDED || 0);

            // console.log("[REPORT] Remote proctoring source snapshot:", {
            //     scheduleId: schedule?._id?.toString() || null,
            //     latestScheduleId: latest?._id?.toString() || null,
            //     usingScheduleRp: !!scheduleRp,
            //     usingLatestRp: !scheduleRp && !!latestRp,
            //     violationCount: rpViolationCount,
            //     tabSwitchCount:
            //         typeof rp?.tabSwitchCount === "number" ? rp.tabSwitchCount : null,
            //     lastViolationReason: rp?.lastViolationReason || null,
            //     reasonCounts: rpReasonCounts,
            //     updatedAt: rp?.updatedAt || null,
            // });

            console.log("[REPORT] PDF request context:", {
                scheduleId: schedule?._id?.toString(),
                candidateId: schedule?.candidate?._id?.toString(),
                jobId: schedule?.job?._id?.toString(),
                latestScheduleId: latest?._id?.toString() || null,
                latestStartAt: latest?.startAt || null,
                interviewType: latest?.interviewType || schedule?.interviewType || null,
                interviewerType: latest?.interviewerType || schedule?.interviewerType || null,
                hasScheduleRemoteProctoring: !!scheduleRp,
                hasLatestRemoteProctoring: !!latestRp,
            });
            console.log("[REPORT] Remote proctoring snapshot used for PDF:", {
                violationCount: rpViolationCount,
                tabSwitchCount:
                    typeof rp?.tabSwitchCount === "number" ? rp.tabSwitchCount : null,
                lastViolationReason: rp?.lastViolationReason || null,
                reasonCounts: rpReasonCounts,
                tabsEvents: rpTabsEvents,
                cameraEvents: rpCameraEvents,
                multiFacesEvents: rpReasonCounts.MULTIPLE_FACES_DETECTED || 0,
                multiVoicesEvents: rpReasonCounts.MULTIPLE_VOICES_DETECTED || 0,
                updatedAt: rp?.updatedAt || null,
            });

            // best-effort conversation (match Interview Detail logic)
            let conversation = null;
            if (Conversation) {
                try {
                    const interviewType = schedule?.interviewType || 'Technical';
                    const interviewerType = schedule?.interviewerType || 'AI';
                    const candidateId = schedule.candidate?._id;
                    const jobId = schedule.job?._id;
                    const scheduleId = schedule._id;
                    const baseCallUUID = `webrtc_${jobId}_${candidateId}`;
                    const scheduleCallUUID = `webrtc_${jobId}_${candidateId}_${scheduleId}`;

                    const filters = [
                        {
                            key: 'schedule+type',
                            filter: {
                                client: req.client,
                                interviewScheduleId: scheduleId,
                                candidateId,
                                jobId,
                                interviewType,
                                interviewerType,
                                isArchived: false,
                            }
                        },
                        {
                            key: 'schedule-only',
                            filter: {
                                client: req.client,
                                interviewScheduleId: scheduleId,
                                candidateId,
                                jobId,
                                isArchived: false,
                            }
                        },
                        {
                            key: 'schedule+callUUID',
                            filter: {
                                client: req.client,
                                interviewScheduleId: scheduleId,
                                candidateId,
                                jobId,
                                callUUID: scheduleCallUUID,
                                isArchived: false,
                            }
                        },
                        {
                            key: 'candidate+job+type',
                            filter: {
                                client: req.client,
                                candidateId,
                                jobId,
                                interviewType,
                                interviewerType,
                                isArchived: false,
                            }
                        },
                        {
                            key: 'candidate+job+callUUID',
                            filter: {
                                client: req.client,
                                candidateId,
                                jobId,
                                callUUID: baseCallUUID,
                                isArchived: false,
                            }
                        },
                        {
                            key: 'candidate+job',
                            filter: {
                                client: req.client,
                                candidateId,
                                jobId,
                                isArchived: false,
                            }
                        },
                    ];

                    for (const entry of filters) {
                        conversation = await Conversation.findOne(entry.filter)
                            .sort({ createdAt: -1 })
                            .lean()
                            .exec();
                        if (conversation?.messages?.length) {
                            console.log('[REPORT] Transcript conversation matched', {
                                scheduleId: scheduleId?.toString(),
                                match: entry.key,
                                messages: conversation.messages.length,
                                conversationId: conversation._id?.toString() || null,
                            });
                            break;
                        }
                    }

                    if (!conversation) {
                        console.warn('[REPORT] No conversation found for transcript', {
                            scheduleId: scheduleId?.toString(),
                            candidateId: candidateId?.toString(),
                            jobId: jobId?.toString(),
                        });
                    }
                } catch (err) {
                    fastify.log.warn({ err }, 'Failed to load conversation; continuing without transcript');
                }
            }

            const scheduleForPdf = {
                ...schedule,
                // force latest video URL, if available
                videoRecordingUrl: latestVideoUrl || schedule.videoRecordingUrl || null,
                // keep meeting link / webrtcLink if you want to show it
                meetingLink: latest?.meetingLink || schedule?.meetingLink || null,
                webrtcLink: latest?.webrtcLink || schedule?.webrtcLink || null,
            };
            console.log("[VIDEO][report] Video URL injected into PDF payload", {
                reportScheduleId: req.params.id,
                chosenUrl:
                    latestVideoUrl || schedule.videoRecordingUrl || null,
                chosenFrom: latestVideoUrl
                    ? "latest.videoRecordingUrl"
                    : (schedule.videoRecordingUrl ? "schedule.videoRecordingUrl" : "none"),
            });

            const candidateName =
                `${schedule.candidate?.firstName || ''} ${schedule.candidate?.lastName || ''}`
                    .trim()
                    .replace(/\s+/g, '_') || 'candidate';

            const datePart = schedule.startAt ? new Date(schedule.startAt).toISOString().slice(0, 10) : 'report';
            const filename = `InterviewReport_${candidateName}_${datePart}.pdf`;

            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `attachment; filename="${filename}"`);

            const pdfStream = generateInterviewReportPdf({
                schedule: scheduleForPdf,
                candidate: schedule.candidate,
                job: schedule.job,
                conversation,
                finalSubmission, // ✅ Pass coding submission data
            });

            return reply.send(pdfStream);
        } catch (err) {
            fastify.log.error({ err }, 'Report generation failed');
            try {
                reply.raw.removeHeader('Content-Type');
                reply.raw.removeHeader('Content-Disposition');
            } catch {
                // no-op
            }
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: err?.message || 'Report generation failed',
                statusCode: 500,
            });
        }
    });

    // Update
    fastify.put('/:id', async (req, reply) => {
        const updated = await svc.update(req.params.id, req.body, req, true);
        if (!updated) return reply.code(404).send({ error: 'Not found' });
        return reply.send(updated);
    });

    // Archive
    fastify.put('/:id/archive', async (req, reply) => {
        const updated = await req.conn.models['InterviewSchedule']
            .findOneAndUpdate(
                { _id: req.params.id, client: req.client },
                { $set: { isArchived: true } },
                { new: true }
            )
            .lean();
        if (!updated) return reply.code(404).send({ error: 'Not found' });
        return reply.send(updated);
    });

    // Unarchive
    fastify.put('/:id/unarchive', async (req, reply) => {
        const updated = await req.conn.models['InterviewSchedule']
            .findOneAndUpdate(
                { _id: req.params.id, client: req.client },
                { $set: { isArchived: false } },
                { new: true }
            )
            .lean();
        if (!updated) return reply.code(404).send({ error: 'Not found' });
        return reply.send(updated);
    });

    // Delete
    fastify.delete('/:id', async (req, reply) => {
        const existing = await svc.readById(req.params.id, req);
        if (!existing) return reply.code(404).send({ error: 'Not found' });
        await svc.delete(req.params.id, req);
        return reply.code(204).send();
    });

    // ── Chat: save a message ─────────────────────────────────────────────────
    fastify.post('/:id/chat', async (req, reply) => {
        try {
            const InterviewSchedule = req.conn.models['InterviewSchedule'];
            const InterviewChat = req.conn.models['InterviewChat'];

            fastify.log.info({ id: req.params.id, client: req.client, body: req.body }, '[ChatSave] POST /:id/chat called');

            if (!InterviewChat) {
                fastify.log.warn('[ChatSave] InterviewChat model unavailable');
                return reply.code(503).send({ error: 'Chat model unavailable' });
            }

            const schedule = await InterviewSchedule.findOne({
                _id: req.params.id,
                client: req.client,
            }).select('candidate job interviewType interviewerType').lean().exec();

            fastify.log.info({ scheduleFound: !!schedule, id: req.params.id, client: req.client }, '[ChatSave] Schedule lookup result');
            if (!schedule) return reply.code(404).send({ error: 'Interview not found' });

            const { messageId, kind, text, senderName, senderRole, file } = req.body || {};

            if (!kind || !['text', 'file'].includes(kind)) {
                return reply.code(400).send({ error: 'Invalid message kind' });
            }

            const message = {
                messageId: messageId || null,
                kind,
                text: text || null,
                senderName: senderName || null,
                senderRole: senderRole || null,
                sentAt: new Date(),
            };

            if (kind === 'file' && file) {
                message.file = {
                    name: file.name || null,
                    size: Number(file.size) || 0,
                    mimeType: file.mimeType || null,
                };
            }

            const filter = {
                interviewScheduleId: schedule._id,
                client: req.client,
            };

            // Avoid duplicate messages using messageId
            const updateQuery = messageId
                ? {
                    $setOnInsert: {
                        candidateId: schedule.candidate,
                        jobId: schedule.job,
                        interviewType: schedule.interviewType,
                        interviewerType: schedule.interviewerType,
                    },
                    $push: {
                        messages: {
                            $each: [message],
                            // Only push if messageId not already present (handled below)
                        },
                    },
                }
                : {
                    $setOnInsert: {
                        candidateId: schedule.candidate,
                        jobId: schedule.job,
                        interviewType: schedule.interviewType,
                        interviewerType: schedule.interviewerType,
                    },
                    $push: { messages: message },
                };

            // If messageId provided, check for duplicate before pushing
            if (messageId) {
                const existing = await InterviewChat.findOne({
                    ...filter,
                    'messages.messageId': messageId,
                });
                if (existing) {
                    return reply.send({ ok: true, duplicate: true });
                }
            }

            const saved = await InterviewChat.findOneAndUpdate(filter, updateQuery, { upsert: true, new: true }).lean().exec();

            fastify.log.info({ messageId: message.messageId, chatId: saved?._id }, '[ChatSave] Message saved successfully');
            return reply.send({ ok: true });
        } catch (err) {
            fastify.log.error({ err, errMsg: err?.message, stack: err?.stack }, '[ChatSave] Failed to save chat message');
            return reply.code(500).send({ error: 'Failed to save chat message', detail: err?.message || String(err) });
        }
    });

    // ── Chat: get history ────────────────────────────────────────────────────
    fastify.get('/:id/chat', async (req, reply) => {
        try {
            const InterviewSchedule = req.conn.models['InterviewSchedule'];
            const InterviewChat = req.conn.models['InterviewChat'];

            fastify.log.info({ id: req.params.id, client: req.client }, '[ChatLoad] GET /:id/chat called');

            if (!InterviewChat) {
                fastify.log.warn('[ChatLoad] InterviewChat model unavailable');
                return reply.send({ chat: null });
            }

            const schedule = await InterviewSchedule.findOne({
                _id: req.params.id,
                client: req.client,
            }).select('_id').lean().exec();

            fastify.log.info({ scheduleFound: !!schedule, id: req.params.id, client: req.client }, '[ChatLoad] Schedule lookup result');
            if (!schedule) return reply.code(404).send({ error: 'Interview not found' });

            const chat = await InterviewChat.findOne({
                interviewScheduleId: schedule._id,
                client: req.client,
            }).lean().exec();

            fastify.log.info({ chatFound: !!chat, messageCount: chat?.messages?.length ?? 0 }, '[ChatLoad] Chat lookup result');
            return reply.send({ chat: chat || null });
        } catch (err) {
            fastify.log.warn({ err }, 'Failed to load chat history');
            return reply.code(500).send({ error: 'Failed to load chat history' });
        }
    });

    // ─── Identity Verification Endpoints ──────────────────────────────────────

    /** Helper: find schedule by candidate+job (and optional token/scheduleId) */
    const findVerificationSchedule = async (req, { candidateId, jobId, interviewScheduleId }) => {
        const InterviewSchedule = req.conn.models['InterviewSchedule'];
        if (!InterviewSchedule) return null;
        if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) return null;

        if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
            const s = await InterviewSchedule.findOne({
                _id: new mongoose.Types.ObjectId(interviewScheduleId),
                client: req.client,
                isArchived: false,
            }).lean().exec();
            if (s) return s;
        }

        return await InterviewSchedule.findOne({
            client: req.client,
            candidate: new mongoose.Types.ObjectId(candidateId),
            job: new mongoose.Types.ObjectId(jobId),
            isArchived: false,
        }).sort({ startAt: -1 }).lean().exec();
    };

    /** Helper: build clean identityVerification payload for client */
    const buildVerificationPayload = (schedule) => {
        const iv = schedule?.identityVerification || {};
        return {
            status: iv.status || 'Pending',
            required: iv.required === true,
            mediaType: iv.mediaType || null,
            mediaUrl: iv.mediaUrl || null,
            referenceDescriptor: Array.isArray(iv.referenceDescriptor) ? iv.referenceDescriptor : [],
            qualityScore: iv.qualityScore ?? null,
            clarityScore: iv.clarityScore ?? null,
            clarityReason: iv.clarityReason || null,
            matchThresholdPercent: Number(iv.matchThresholdPercent) > 0 ? Number(iv.matchThresholdPercent) : 70,
            submittedAt: iv.submittedAt || null,
            completedAt: iv.completedAt || null,
            lastMatchScore: iv.lastMatchScore ?? null,
            mismatchCount: iv.mismatchCount || 0,
            lastError: iv.lastError || null,
        };
    };

    /** Helper: parse descriptor from stringified JSON or array */
    const parseDescriptor = (raw) => {
        try {
            if (Array.isArray(raw)) return raw.map(Number).filter(Number.isFinite);
            if (typeof raw === 'string') {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
            }
        } catch { /* ignore */ }
        return [];
    };

    /** Helper: read file buffer from multipart part */
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

    /** Helper: find file-like part in multipart body */
    const findFilePart = (body = {}, key = 'media') => {
        const isFileLike = (v) => {
            if (!v) return false;
            if (Buffer.isBuffer(v) || Buffer.isBuffer(v?._buf) || Buffer.isBuffer(v?.data)) return true;
            if (Buffer.isBuffer(v?.value?._buf) || Buffer.isBuffer(v?.value?.data)) return true;
            if (typeof v?.toBuffer === 'function' || typeof v?.value?.toBuffer === 'function') return true;
            return v?.type === 'file' || v?.value?.type === 'file';
        };
        if (isFileLike(body[key])) return body[key];
        for (const k of Object.keys(body)) {
            if (isFileLike(body[k])) return body[k];
        }
        return null;
    };

    /** Helper: get string field value from multipart or plain body */
    const fieldVal = (v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' || typeof v === 'number') return String(v);
        if (typeof v?.value === 'string') return v.value;
        return String(v?.value ?? v ?? '');
    };

    // GET /verification/status — get current verification status for a schedule
    fastify.get('/verification/status', async (req, reply) => {
        const candidateId = String(req.query?.candidateId || '').trim();
        const jobId = String(req.query?.jobId || '').trim();
        const interviewScheduleId = String(req.query?.interviewScheduleId || req.query?.scheduleId || '').trim();

        if (!candidateId || !jobId) {
            return reply.code(400).send({ ok: false, error: 'candidateId and jobId are required' });
        }

        const schedule = await findVerificationSchedule(req, { candidateId, jobId, interviewScheduleId });
        if (!schedule) {
            return reply.code(404).send({ ok: false, error: 'Interview schedule not found' });
        }

        return reply.send({
            ok: true,
            scheduleId: schedule._id,
            verification: buildVerificationPayload(schedule),
            interviewLink: schedule.webrtcLink || null,
            interviewAccessToken: schedule.webrtcAccessToken || null,
            startAt: schedule.startAt || null,
        });
    });

    // POST /verification/submit — candidate uploads face photo/video for verification
    fastify.post('/verification/submit', async (req, reply) => {
        try {
            const body = req.body || {};
            const candidateId = String(fieldVal(body?.candidateId)).trim();
            const jobId = String(fieldVal(body?.jobId)).trim();
            const interviewScheduleId = String(fieldVal(body?.interviewScheduleId || body?.scheduleId)).trim();
            const requestedMediaType = String(fieldVal(body?.mediaType)).trim().toLowerCase();

            if (!candidateId || !jobId) {
                return reply.code(400).send({ ok: false, error: 'candidateId and jobId are required' });
            }

            const schedule = await findVerificationSchedule(req, { candidateId, jobId, interviewScheduleId });
            if (!schedule) return reply.code(404).send({ ok: false, error: 'Interview schedule not found' });

            const descriptor = parseDescriptor(fieldVal(body?.descriptor));
            const qualityScore = parseFloat(fieldVal(body?.qualityScore)) || 0;
            const clarityScore = parseFloat(fieldVal(body?.clarityScore)) || qualityScore;
            const clarityReason = String(fieldVal(body?.clarityReason) || '').trim() || null;

            if (descriptor.length < 32) {
                return reply.code(422).send({ ok: false, error: 'Unable to verify face. Please upload a clearer image.' });
            }
            if (qualityScore < 45) {
                return reply.code(422).send({ ok: false, error: 'Image quality too low. Please upload a clearer photo/video.' });
            }

            const filePart = findFilePart(body, 'media');
            if (!filePart) return reply.code(400).send({ ok: false, error: 'Verification media file is required' });

            const buffer = await readFileBuffer(filePart);
            if (!buffer || !buffer.length) return reply.code(400).send({ ok: false, error: 'Unable to read uploaded file' });

            const filenameRaw = String(filePart?.filename || filePart?.name || filePart?.value?.filename || 'verification');
            const mimetype = String(filePart?.mimetype || filePart?.type || filePart?.value?.mimetype || '').toLowerCase();
            const extFromMime = (() => {
                if (mimetype.includes('png')) return 'png';
                if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return 'jpg';
                if (mimetype.includes('webp')) return 'webp';
                if (mimetype.includes('mp4')) return 'mp4';
                if (mimetype.includes('webm')) return 'webm';
                return filenameRaw.split('.').pop()?.toLowerCase() || 'jpg';
            })();
            const mediaType = ['photo', 'video', 'live_photo'].includes(requestedMediaType)
                ? requestedMediaType
                : (mimetype.startsWith('video/') ? 'video' : 'photo');

            const remotePath = `interviewVerification/${String(req.client)}/${String(schedule._id)}/${Date.now()}.${extFromMime}`;
            await uploadBufferToFirebase(buffer, remotePath, mimetype || 'image/jpeg');
            const mediaUrl = await getDownloadURL(remotePath);

            const now = new Date();
            const identityVerification = {
                ...(schedule.identityVerification || {}),
                status: 'Completed',
                required: true,
                mediaType,
                mediaUrl,
                previewImageUrl: mediaType === 'video' ? null : mediaUrl,
                referenceDescriptor: descriptor,
                qualityScore,
                clarityScore,
                clarityReason,
                submittedAt: now,
                completedAt: now,
                lastMatchScore: null,
                lastLiveCheckAt: null,
                lastMatchAt: null,
                lastMismatchAt: null,
                mismatchCount: 0,
                lastLiveFaceCount: null,
                lastError: null,
                matchThresholdPercent: schedule.identityVerification?.matchThresholdPercent || 70,
            };

            const InterviewSchedule = req.conn.models['InterviewSchedule'];
            const updated = await InterviewSchedule.findOneAndUpdate(
                { _id: schedule._id, client: req.client },
                { $set: { identityVerification } },
                { new: true }
            ).lean().exec();

            return reply.send({
                ok: true,
                scheduleId: updated?._id || schedule._id,
                verification: buildVerificationPayload(updated || schedule),
                interviewLink: updated?.webrtcLink || schedule.webrtcLink || null,
                interviewAccessToken: updated?.webrtcAccessToken || schedule.webrtcAccessToken || null,
            });
        } catch (err) {
            console.error('[Verification][submit] Failed:', err?.message || err);
            return reply.code(500).send({ ok: false, error: err?.message || 'Failed to submit verification' });
        }
    });

    // POST /verification/match-log — log continuous face match result during interview
    fastify.post('/verification/match-log', async (req, reply) => {
        const body = req.body || {};
        const candidateId = String(body?.candidateId || '').trim();
        const jobId = String(body?.jobId || '').trim();
        const interviewScheduleId = String(body?.interviewScheduleId || body?.scheduleId || '').trim();
        const matchScore = Number(body?.matchScore);
        const faceCount = Number(body?.faceCount);
        const matched = body?.matched === true || String(body?.matched || '').toLowerCase() === 'true';
        const reason = String(body?.reason || '').trim() || null;

        if (!candidateId || !jobId) {
            return reply.code(400).send({ ok: false, error: 'candidateId and jobId are required' });
        }

        const schedule = await findVerificationSchedule(req, { candidateId, jobId, interviewScheduleId });
        if (!schedule) return reply.code(404).send({ ok: false, error: 'Schedule not found' });

        const current = schedule.identityVerification || {};
        const now = new Date();
        const identityVerification = {
            ...current,
            lastMatchScore: Number.isFinite(matchScore) ? matchScore : (current.lastMatchScore ?? null),
            lastLiveCheckAt: now,
            lastLiveFaceCount: Number.isFinite(faceCount) ? faceCount : (current.lastLiveFaceCount ?? null),
            mismatchCount: (current.mismatchCount || 0) + (matched ? 0 : 1),
            lastMatchAt: matched ? now : (current.lastMatchAt || null),
            lastMismatchAt: matched ? (current.lastMismatchAt || null) : now,
            lastError: matched ? null : (reason || 'Face mismatch during interview'),
        };

        const InterviewSchedule = req.conn.models['InterviewSchedule'];
        await InterviewSchedule.findOneAndUpdate(
            { _id: schedule._id, client: req.client },
            { $set: { identityVerification } }
        ).lean().exec();

        return reply.send({ ok: true });
    });
}
