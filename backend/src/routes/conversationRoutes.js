import mongoose from 'mongoose';
import ConversationService from '../services/conversationService.js';
import { setupAuthAndOtherDetails } from './candidateFromJobSocialRoutes.js';
import RelevancyService from '../services/relevancyService.js';

const svc = new ConversationService();
const relevancySvc = new RelevancyService();

export async function conversationRoutesWithoutAuth(fastify) {

    fastify.get('/demo/', async (req, reply) => {
        const { jobId, candidateId, callUUID, interviewScheduleId /*, clientId */ } = req.query;
        const filter = {};

        if (!callUUID || !String(callUUID).includes('call_simulation')) {
            throw new Error("Invalid call id...");
        }

        await setupAuthAndOtherDetails(req, (process.env.NODE_ENV === "production" ? "support@applycup.com" : "admin@aiselekt.com"));

        if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
            filter.jobId = new mongoose.Types.ObjectId(jobId);
        }

        if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
            filter.candidateId = new mongoose.Types.ObjectId(candidateId);
        }

        if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
            filter.interviewScheduleId = new mongoose.Types.ObjectId(interviewScheduleId);
        }

        if (callUUID) {
            filter.callUUID = callUUID;
        }

        // Populate job and candidate so the client can render without extra API calls
        const list = await req.conn.models['Conversation']
            .find(filter)
            .populate([
                { path: 'whatsappConvId', model: "Conversation", select: "messages" },
                { path: 'jobId', select: 'title internalTitle' },
                { path: 'candidateId', select: 'firstName lastName email' },
            ])
            .sort('-_id')
            .lean()
            .exec();

        return reply.send(list);
    });

}

export default async function conversationRoutes(fastify) {
    console.log('🧩 [ConversationRoutes] Registering authenticated conversation routes...');

    // Auth as-is
    fastify.addHook('preHandler', fastify.authenticate);


    fastify.post('/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        console.log('📝 [ConversationRoutes] POST /api/conversation - body:', req.body);
        try {
            const doc = await svc.create(req.body, req);
            console.log('✅ [ConversationRoutes] Conversation created with _id:', doc?._id);

            // 🔁 Trigger communication relevancy update based on this conversation (non-blocking)
            try {
                if (doc?.candidateId && doc?.jobId) {
                    relevancySvc
                        .updateFromConversation({
                            client: req.client,
                            candidateId: doc.candidateId,
                            jobId: doc.jobId,
                            conn: req.conn,
                            user: req.user
                        })
                        .catch(err => {
                            console.error('❌ [ConversationRoutes] updateFromConversation (POST /) error:', err?.message || err);
                        });
                }
            } catch (err) {
                console.error('❌ [ConversationRoutes] Failed to enqueue relevancy update (POST /):', err?.message || err);
            }

            return reply.code(201).send(doc);
        } catch (err) {
            console.error('❌ [ConversationRoutes] Error creating conversation:', err?.message || err);
            return reply.code(400).send({ error: err.message });
        }
    });

    fastify.get('/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const {
            jobId,
            candidateId,
            callUUID,
            interviewType,
            interviewerType,
            interviewScheduleId /*, clientId */
        } = req.query;
        const filter = {};

        console.log('🔍 [ConversationRoutes] GET /api/conversation - query:', req.query);

        if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
            filter.jobId = new mongoose.Types.ObjectId(jobId);
        }

        if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
            filter.candidateId = new mongoose.Types.ObjectId(candidateId);
        }

        if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
            filter.interviewScheduleId = new mongoose.Types.ObjectId(interviewScheduleId);
        }

        if (callUUID) {
            filter.callUUID = callUUID;
        }

        if (interviewType) {
            filter.interviewType = interviewType;
        }

        if (interviewerType) {
            filter.interviewerType = interviewerType;
        }

        console.log('🔎 [ConversationRoutes] Mongo filter:', filter);

        const list = await req.conn.models['Conversation']
            .find(filter)
            .populate([
                { path: 'jobId', select: 'title internalTitle' },
                { path: 'candidateId', select: 'firstName lastName email' },
            ])
            .sort('-_id')
            .lean()
            .exec();

        console.log('📦 [ConversationRoutes] Conversations found:', list.length);
        return reply.send(list);
    });

    /**
     * NEW: append a single message into Conversation, prefixing the text with the
     * logged-in user’s name, but ONLY when interviewerType is Human / Human+AI.
     *
     * Also, partition conversations by interviewType + interviewerType so that
     * the same candidate+job can have multiple distinct conversations.
     *
     * Body:
     * {
     *   "candidateId": "<candidate ObjectId>",
     *   "jobId": "<job ObjectId>",
     *   "text": "actual message text"
     * }
     */
    fastify.post('/message', async (req, reply) => {
        console.log('\n💬 [ConversationRoutes] POST /api/conversation/message - incoming body:', req.body);
        try {
            const { candidateId, jobId, text } = req.body || {};

            if (!text || typeof text !== 'string' || !text.trim()) {
                console.warn('⚠️ [ConversationRoutes] /message - missing text');
                return reply.code(400).send({ error: 'text is required' });
            }

            if (!candidateId || !jobId) {
                console.warn('⚠️ [ConversationRoutes] /message - missing candidateId or jobId');
                return reply.code(400).send({ error: 'candidateId and jobId are required' });
            }

            if (
                !mongoose.Types.ObjectId.isValid(candidateId) ||
                !mongoose.Types.ObjectId.isValid(jobId)
            ) {
                console.warn('⚠️ [ConversationRoutes] /message - invalid ObjectId for candidateId or jobId', {
                    candidateId,
                    jobId
                });
                return reply.code(400).send({ error: 'Invalid candidateId or jobId' });
            }

            const candObjId = new mongoose.Types.ObjectId(candidateId);
            const jobObjId = new mongoose.Types.ObjectId(jobId);

            const UserModel = req.conn.models['User'];
            console.log('👤 [ConversationRoutes] /message - fetching current user:', {
                userId: req.user?._id,
                client: req.client
            });

            const currentUser = await UserModel.findOne({
                _id: req.user._id,
                client: req.client,
                isArchived: false
            })
                .select('firstName lastName email role')
                .lean()
                .exec();

            if (!currentUser) {
                console.warn('⚠️ [ConversationRoutes] /message - current user not found or inactive');
                return reply.code(403).send({ error: 'User not found or inactive' });
            }

            console.log('👤 [ConversationRoutes] /message - current user loaded:', {
                id: currentUser._id,
                email: currentUser.email,
                role: currentUser.role
            });

            const displayName =
                `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
                currentUser.email ||
                'User';

            // Map platform role → conversation message.role
            // - candidate login: 'candidate'
            // - interviewer login: use 'assistant' so evaluation treats it as interviewer
            let messageRole = 'user';
            if (currentUser.role === 'candidate') {
                messageRole = 'candidate';
            } else if (currentUser.role === 'interviewer') {
                messageRole = 'assistant';
            }

            console.log('🧭 [ConversationRoutes] /message - resolved message role:', messageRole);

            // Check interview type; only decorate for Human / Human+AI as requested
            const InterviewSchedule = req.conn.models['InterviewSchedule'];
            console.log('🔎 [ConversationRoutes] /message - looking up InterviewSchedule for candidate+job...', {
                client: String(req.client),
                candidateId: String(candObjId),
                jobId: String(jobObjId)
            });

            const schedule = await InterviewSchedule.findOne({
                client: req.client,
                candidate: candObjId,
                job: jobObjId,
                isArchived: false
            })
                .sort({ startAt: -1 })
                .lean()
                .exec();

            if (!schedule) {
                console.warn('⚠️ [ConversationRoutes] /message - InterviewSchedule not found for candidate+job');
                return reply
                    .code(404)
                    .send({ error: 'Interview schedule not found for candidate+job' });
            }

            console.log('📅 [ConversationRoutes] /message - schedule found:', {
                id: schedule._id,
                interviewerType: schedule.interviewerType,
                interviewType: schedule.interviewType,
                interviewMode: schedule.interviewMode,
                startAt: schedule.startAt
            });

            const interviewerType = schedule.interviewerType || 'AI';
            const interviewType = schedule.interviewType || 'Technical';

            if (interviewerType !== 'Human' && interviewerType !== 'Human+AI') {
                console.warn('⚠️ [ConversationRoutes] /message - interviewerType is not Human/Human+AI:', interviewerType);
                // For AI-only interviews, keep existing AI flows; don’t use this endpoint.
                return reply.code(400).send({
                    error: 'This endpoint is only for Human or Human+AI interviews'
                });
            }

            const prefixedText = `[${displayName}] ${text.trim()}`;
            console.log('✏️ [ConversationRoutes] /message - final stored text:', prefixedText);

            const Conversation = req.conn.models['Conversation'];
            const nowTs = new Date();

            const filter = {
                candidateId: candObjId,
                jobId: jobObjId,
                client: req.client,
                interviewType,
                interviewerType,
                isArchived: false
            };

            const setOnInsert = {
                callUUID:
                    schedule.webrtcLink
                        ? `webrtc_${jobId}_${candidateId}`
                        : `manual_${jobId}_${candidateId}`,
                interviewType,
                interviewerType,
                interviewScheduleId: schedule._id
            };

            console.log('🧷 [ConversationRoutes] /message - upserting Conversation with key:', {
                ...filter,
                interviewScheduleId: String(schedule._id)
            });

            const updatedConv = await Conversation.findOneAndUpdate(
                filter,
                {
                    $setOnInsert: setOnInsert,
                    $push: {
                        messages: {
                            role: messageRole,
                            content: prefixedText,
                            time: nowTs
                        }
                    }
                },
                { upsert: true, new: true }
            )
                .populate([
                    { path: 'jobId', select: 'title internalTitle' },
                    { path: 'candidateId', select: 'firstName lastName email' }
                ])
                .lean()
                .exec();

            console.log('✅ [ConversationRoutes] /message - conversation updated:', {
                conversationId: updatedConv?._id,
                messagesCount: updatedConv?.messages?.length
            });

            // 🔁 Trigger communication relevancy update based on this conversation (non-blocking)
            try {
                relevancySvc
                    .updateFromConversation({
                        client: req.client,
                        candidateId: candObjId,
                        jobId: jobObjId,
                        conn: req.conn,
                        user: req.user
                    })
                    .catch(err => {
                        console.error('❌ [ConversationRoutes] updateFromConversation (/message) error:', err?.message || err);
                    });
            } catch (err) {
                console.error('❌ [ConversationRoutes] Failed to enqueue relevancy update (/message):', err?.message || err);
            }

            return reply.send(updatedConv);
        } catch (err) {
            console.error('❌ [ConversationRoutes] /message error:', err?.message || err);
            return reply
                .code(500)
                .send({ error: err?.message || 'Failed to append message' });
        }
    });

    fastify.get('/:candidateId/:jobId/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { jobId, candidateId } = req.params;
        const { interviewScheduleId, callUUID } = req.query || {};
        const filter = {
            "callUUID": { "$not": { "$regex": "wa_conv_____" } }
        };

        console.log('🔍 [ConversationRoutes] GET /api/conversation/:candidateId/:jobId - params:', req.params);

        if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
            filter.jobId = new mongoose.Types.ObjectId(jobId);
        }
        if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
            filter.candidateId = new mongoose.Types.ObjectId(candidateId);
        }

        if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
            filter.interviewScheduleId = new mongoose.Types.ObjectId(interviewScheduleId);
        }

        if (callUUID) {
            filter.callUUID = callUUID;
        }

        console.log('🔎 [ConversationRoutes] Mongo filter:', filter);

        const list = await req.conn.models['Conversation']
            .find(filter)
            .populate([
                { path: 'whatsappConvId', model: "Conversation", select: "messages" },
                { path: 'jobId', select: 'title internalTitle' },
                { path: 'candidateId', select: 'firstName lastName email' },
            ])
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        if (!Array.isArray(list) || list.length === 0) {
            console.warn('⚠️ [ConversationRoutes] No conversations found for filter:', filter);
            return reply.send([]);
        }

        const hasNonSystemMessages = conv =>
            Array.isArray(conv?.messages) &&
            conv.messages.some(m => String(m?.role || '').toLowerCase() !== 'system');

        const isAiCallCandidate = conv => {
            if (conv?.interviewScheduleId) return false;
            const callUUID = String(conv?.callUUID || '');
            return !callUUID.startsWith('webrtc_') && !callUUID.startsWith('manual_');
        };

        const preferAiCall = !interviewScheduleId && !callUUID;
        let finalConv = null;

        if (preferAiCall) {
            finalConv =
                list.find(conv => isAiCallCandidate(conv) && hasNonSystemMessages(conv)) ||
                list.find(conv => isAiCallCandidate(conv)) ||
                null;
        } else {
            finalConv = list.find(conv => hasNonSystemMessages(conv)) || list[0] || null;
        }

        if (preferAiCall && !finalConv) {
            console.warn('⚠️ [ConversationRoutes] No AI call conversation found; skipping interview transcripts');
            return reply.send([]);
        }
        if (!finalConv) {
            console.warn('⚠️ [ConversationRoutes] Conversation list empty after selection:', {
                total: list.length
            });
            return reply.send([]);
        }

        finalConv.messages = [
            ...(finalConv?.messages || []),
            ...(finalConv?.whatsappConvId?.messages || [])
        ];

        console.log('📦 [ConversationRoutes] Latest conversation fetched for candidate+job');
        return reply.send([finalConv]);
    });

    fastify.get('/:id', async (req, reply) => {
        const { id } = req.params;
        console.log('🔍 [ConversationRoutes] GET /api/conversation/:id - id:', id);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn('⚠️ [ConversationRoutes] Invalid conversation id:', id);
            return reply.code(400).send({ error: 'Invalid ID' });
        }

        const conv = await svc.readById(id, req);
        if (!conv) {
            console.warn('⚠️ [ConversationRoutes] Conversation not found for id:', id);
            return reply.code(404).send({ error: 'Conversation not found' });
        }

        console.log('✅ [ConversationRoutes] Conversation loaded for id:', id);
        return reply.send(conv);
    });

    fastify.put('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { id } = req.params;
        console.log('✏️ [ConversationRoutes] PUT /api/conversation/:id - id:', id);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn('⚠️ [ConversationRoutes] Invalid conversation id for update:', id);
            return reply.code(400).send({ error: 'Invalid ID' });
        }

        const updated = await svc.update(id, req.body, req);
        if (!updated) {
            console.warn('⚠️ [ConversationRoutes] Conversation not found for update - id:', id);
            return reply.code(404).send({ error: 'Conversation not found' });
        }

        console.log('✅ [ConversationRoutes] Conversation updated - id:', id);

        // 🔁 Trigger communication relevancy update on update, when we know candidate+job (non-blocking)
        try {
            if (updated?.candidateId && updated?.jobId) {
                relevancySvc
                    .updateFromConversation({
                        client: req.client,
                        candidateId: updated.candidateId,
                        jobId: updated.jobId,
                        conn: req.conn,
                        user: req.user
                    })
                    .catch(err => {
                        console.error('❌ [ConversationRoutes] updateFromConversation (PUT /:id) error:', err?.message || err);
                    });
            }
        } catch (err) {
            console.error('❌ [ConversationRoutes] Failed to enqueue relevancy update (PUT /:id):', err?.message || err);
        }

        return reply.send(updated);
    });

    fastify.delete('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { id } = req.params;
        console.log('🗑 [ConversationRoutes] DELETE /api/conversation/:id - id:', id);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.warn('⚠️ [ConversationRoutes] Invalid conversation id for delete:', id);
            return reply.code(400).send({ error: 'Invalid ID' });
        }

        const exists = await svc.readById(id, req);
        if (!exists) {
            console.warn('⚠️ [ConversationRoutes] Conversation not found for delete - id:', id);
            return reply.code(404).send({ error: 'Conversation not found' });
        }

        await svc.delete(id, req);
        console.log('✅ [ConversationRoutes] Conversation deleted - id:', id);
        return reply.code(204).send();
    });
    const buildAiCallOnlyFilter = ({ client, jobId = '', direction = '' } = {}) => {
        const filter = {
            client,
            isArchived: false,
            interviewerType: 'AI',
            // Note: interviewScheduleId may be set on reminder calls — intentionally not filtering it out.
            // WebRTC/manual/WhatsApp conversation rows are excluded below via callUUID prefix pattern.
            $and: [
                {
                    $or: [
                        { callUUID: { $exists: false } },
                        { callUUID: null },
                        { callUUID: { $not: /^(webrtc_|manual_|wa_conv_____)/ } },
                    ],
                },
            ],
        };

        if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
            filter.jobId = new mongoose.Types.ObjectId(jobId);
        }

        if (direction === 'inbound') {
            filter.direction = 'inbound';
        } else if (direction === 'outbound') {
            filter.$and.push({
                $or: [
                    { direction: 'outbound' },
                    { direction: { $exists: false } },
                    { direction: null },
                ],
            });
        }

        return filter;
    };

    const buildAiCallLogDedupePipeline = ({ filter, skip = 0, limit = 25, countOnly = false } = {}) => {
        const dedupeKeyExpr = {
            $switch: {
                branches: [
                    {
                        case: {
                            $and: [
                                { $eq: ['$callType', 'reminder'] },
                                { $ne: [{ $ifNull: ['$interviewScheduleId', null] }, null] },
                            ],
                        },
                        then: {
                            $concat: ['reminder:', { $toString: '$interviewScheduleId' }],
                        },
                    },
                    {
                        case: {
                            $gt: [
                                { $strLenCP: { $ifNull: ['$callUUID', ''] } },
                                0,
                            ],
                        },
                        then: {
                            $concat: ['uuid:', '$callUUID'],
                        },
                    },
                    {
                        case: {
                            $and: [
                                {
                                    $eq: [
                                        { $strLenCP: { $ifNull: ['$callUUID', ''] } },
                                        0,
                                    ],
                                },
                                { $ne: [{ $ifNull: ['$createdAt', null] }, null] },
                                {
                                    $or: [
                                        { $ne: [{ $ifNull: ['$candidateId', null] }, null] },
                                        { $gt: [{ $strLenCP: { $ifNull: ['$mobile_num', ''] } }, 0] },
                                    ],
                                },
                            ],
                        },
                        then: {
                            $concat: [
                                'legacy:',
                                { $toString: { $ifNull: ['$candidateId', 'no_candidate'] } },
                                '|',
                                { $toString: { $ifNull: ['$jobId', 'no_job'] } },
                                '|',
                                { $ifNull: ['$direction', ''] },
                                '|',
                                { $ifNull: ['$callType', ''] },
                                '|',
                                { $ifNull: ['$mobile_num', ''] },
                                '|',
                                { $ifNull: ['$calledNumber', ''] },
                                '|',
                                {
                                    $dateToString: {
                                        format: '%Y-%m-%dT%H:%M:%S',
                                        date: '$createdAt',
                                        timezone: 'UTC',
                                    },
                                },
                            ],
                        },
                    },
                ],
                default: {
                    $concat: ['doc:', { $toString: '$_id' }],
                },
            },
        };

        const completenessExpr = {
            $add: [
                {
                    $cond: [
                        { $gt: [{ $strLenCP: { $ifNull: ['$calledNumber', ''] } }, 0] },
                        4,
                        0,
                    ],
                },
                {
                    $cond: [
                        { $gt: [{ $strLenCP: { $ifNull: ['$callType', ''] } }, 0] },
                        4,
                        0,
                    ],
                },
                {
                    $cond: [
                        { $gt: [{ $ifNull: ['$durationSeconds', 0] }, 0] },
                        2,
                        0,
                    ],
                },
                {
                    $cond: [
                        { $gt: [{ $size: { $ifNull: ['$messages', []] } }, 1] },
                        1,
                        0,
                    ],
                },
                {
                    $cond: [
                        { $gt: [{ $strLenCP: { $ifNull: ['$audio_url', ''] } }, 0] },
                        1,
                        0,
                    ],
                },
            ],
        };

        const pipeline = [
            { $match: filter },
            {
                $addFields: {
                    __callLogDedupeKey: dedupeKeyExpr,
                    __callLogCompleteness: completenessExpr,
                },
            },
            { $sort: { createdAt: -1, __callLogCompleteness: -1, updatedAt: -1, _id: -1 } },
            {
                $group: {
                    _id: '$__callLogDedupeKey',
                    doc: { $first: '$$ROOT' },
                },
            },
            { $replaceRoot: { newRoot: '$doc' } },
            { $sort: { createdAt: -1, updatedAt: -1, _id: -1 } },
        ];

        if (countOnly) {
            pipeline.push({ $count: 'total' });
            return pipeline;
        }

        pipeline.push({ $project: { __callLogDedupeKey: 0, __callLogCompleteness: 0 } });
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });
        return pipeline;
    };

    // ── GET /api/conversations/ai-calls/ ─────────────────────────────────────
    // List only AI phone-call conversations, excluding AI interview sessions.
    fastify.get('/ai-calls/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'manager', 'recruiter'].includes(req.user.role)) {
            return reply.code(403).send({ ok: false, message: 'Access denied' });
        }

        const { page = 1, pageSize = 25, jobId = '', direction = '' } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limit = Math.min(100, Math.max(1, parseInt(pageSize)));
        const skip = (pageNum - 1) * limit;

        const filter = buildAiCallOnlyFilter({ client: req.client, jobId, direction });
        const conversationModel = req.conn.models.Conversation;

        const [conversations, total] = await Promise.all([
            conversationModel
                .aggregate(buildAiCallLogDedupePipeline({ filter, skip, limit }))
                .exec(),
            conversationModel
                .aggregate(buildAiCallLogDedupePipeline({ filter, countOnly: true }))
                .exec(),
        ]);

        const dedupedConversations = await conversationModel.populate(conversations, [
            { path: 'candidateId', select: 'firstName lastName countryCode phoneNumber email' },
            { path: 'jobId', select: 'title internalTitle' },
        ]);
        const dedupedTotal = total?.[0]?.total || 0;

        // Enrich with CandidateATS call metadata (status, duration, hangup cause)
        const items = await Promise.all(dedupedConversations.map(async (conv) => {
            if (!conv.candidateId?._id || !conv.jobId?._id) return { ...conv, ats: null };
            const ats = await req.conn.models.CandidateATS.findOne(
                { candidate: conv.candidateId._id, job: conv.jobId._id, isArchived: false },
                'aiCallStatus callAudioDuration aiCallHangUpCause aiCallHangUpSource'
            ).lean().exec();
            return { ...conv, ats: ats || null };
        }));

        return reply.send({ items, total: dedupedTotal, page: pageNum, pageSize: limit });
    });

    // ── GET /api/conversations/ai-calls/:id ───────────────────────────────────
    // Single AI phone call with full messages array for transcript modal.
    fastify.get('/ai-calls/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'manager', 'recruiter'].includes(req.user.role)) {
            return reply.code(403).send({ ok: false, message: 'Access denied' });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ ok: false, message: 'Invalid ID' });
        }

        const filter = buildAiCallOnlyFilter({ client: req.client });
        filter._id = id;

        const conv = await req.conn.models.Conversation
            .findOne(filter)
            .populate('candidateId', 'firstName lastName countryCode phoneNumber email')
            .populate('jobId', 'title internalTitle')
            .lean()
            .exec();

        if (!conv) return reply.code(404).send({ ok: false, message: 'Not found' });

        let ats = null;
        if (conv.candidateId?._id && conv.jobId?._id) {
            ats = await req.conn.models.CandidateATS.findOne(
                { candidate: conv.candidateId._id, job: conv.jobId._id, isArchived: false },
                'aiCallStatus callAudioDuration aiCallHangUpCause aiCallHangUpSource transcript'
            ).lean().exec();
        }

        return reply.send({ ...conv, ats: ats || null });
    });
    console.log('✅ [ConversationRoutes] Authenticated conversation routes registered');
}



