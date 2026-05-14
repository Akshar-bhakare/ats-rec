// backend/src/routes/VirtualInterview/webrtcRoomRoutes.js

import fp from 'fastify-plugin';
import mongoose from 'mongoose';
import { getClientDbConn } from '../../utils/clientDbUtils.js';

/**
 * In-memory room registry:
 *   Map<roomId, Set<WebSocket>>
 *
 * This is process-local and will reset on restart,
 * which is fine for your current single-instance setup.
 */
const rooms = new Map();
const roomStates = new Map();

const normalizeHeaderToken = (value) => {
    if (!value) return null;
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.toLowerCase().startsWith('bearer ')) return raw.slice(7).trim();
    return raw;
};

const parseWsQuery = (req) => {
    const params = new URL(req.raw?.url || '', 'http://localhost').searchParams;
    const token =
        params.get('token') ||
        params.get('t') ||
        params.get('authToken') ||
        null;

    return {
        token,
        candidateId: params.get('candidateId') || params.get('cid') || null,
        jobId: params.get('jobId') || params.get('jid') || null,
        interviewScheduleId: params.get('interviewScheduleId') || params.get('iid') || null,
        peerId: params.get('peerId') || null
    };
};

const getRoomState = (roomId) => {
    let state = roomStates.get(roomId);
    if (!state) {
        state = {
            roomId,
            createdAt: new Date(),
            participants: new Map()
        };
        roomStates.set(roomId, state);
    }
    return state;
};

const buildRoomSnapshot = (state) => ({
    roomId: state.roomId,
    createdAt: state.createdAt,
    participantCount: state.participants.size,
    participants: Array.from(state.participants.entries()).map(([peerId, info]) => ({
        peerId,
        joinedAt: info.joinedAt,
        lastSeenAt: info.lastSeenAt,
        userAgent: info.userAgent
    }))
});

/**
 * WebRTC signaling room routes.
 *
 * Exposed as a Fastify plugin so you can register with:
 *   fastify.register(webrtcRoomRoutes);
 */
async function webrtcRoomRoutes(fastify, _opts) {
    const applyAuthFromToken = async (req, rawToken) => {
        const token = normalizeHeaderToken(rawToken);
        if (!token) throw new Error('Missing token');

        const jwtRes = await fastify.jwt.verify(token);
        if (!jwtRes?.dbName) throw new Error('Invalid token');

        req.dbName = jwtRes.dbName;
        req.conn = await getClientDbConn(jwtRes.dbName);
        const user = await req.conn.models['User'].findById(jwtRes.sub).lean().exec();
        if (!user) throw new Error('User not found');

        req.user = { ...user, ...jwtRes };
        req.client = user?.clientId || user?.client || user?._id;
    };

    const persistEvent = async (req, payload) => {
        try {
            const Model = req.conn?.models?.WebRTCSessionEvent;
            if (!Model || !req.client) return;
            const candidateObjId = payload.candidateId && mongoose.Types.ObjectId.isValid(payload.candidateId)
                ? new mongoose.Types.ObjectId(payload.candidateId)
                : null;
            const jobObjId = payload.jobId && mongoose.Types.ObjectId.isValid(payload.jobId)
                ? new mongoose.Types.ObjectId(payload.jobId)
                : null;
            const scheduleObjId = payload.interviewScheduleId && mongoose.Types.ObjectId.isValid(payload.interviewScheduleId)
                ? new mongoose.Types.ObjectId(payload.interviewScheduleId)
                : null;

            await Model.create({
                client: req.client,
                roomId: payload.roomId,
                interviewScheduleId: scheduleObjId,
                candidate: candidateObjId,
                job: jobObjId,
                peerId: payload.peerId || null,
                eventType: payload.eventType,
                details: payload.details || null,
                ip: payload.ip || null,
                userAgent: payload.userAgent || null
            });
        } catch (err) {
            fastify.log.warn({ err }, '[WS] Failed to persist WebRTC session event');
        }
    };

    const broadcastRoomState = (roomId) => {
        const clients = rooms.get(roomId);
        const state = roomStates.get(roomId);
        if (!clients || !state) return;
        const snapshot = buildRoomSnapshot(state);
        for (const client of clients) {
            if (client.readyState !== client.OPEN) continue;
            try {
                client.send(JSON.stringify({ type: 'room_state', data: snapshot }));
            } catch (err) {
                fastify.log.warn({ err, roomId }, '[WS] Failed to send room state');
            }
        }
    };

    fastify.get(
        '/api/webrtc/rooms/:roomId',
        { websocket: true },
        (connection, req) => {
            // In some setups connection = { socket }, in others it is the socket itself.
            const socket = connection.socket || connection;

            if (!socket || typeof socket.on !== 'function') {
                fastify.log.error(
                    { connectionType: typeof connection },
                    '[WS] Invalid WebSocket connection object – cannot attach listeners'
                );
                return;
            }

            const { roomId } = req.params;
            const { token, candidateId, jobId, interviewScheduleId, peerId: queryPeerId } = parseWsQuery(req);
            const userAgent = req.headers['user-agent'] || '';
            const ip =
                (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
                req.ip ||
                null;

            if (token) {
                applyAuthFromToken(req, token).catch((err) => {
                    fastify.log.warn({ err }, '[WS] Token auth failed for signaling socket');
                });
            }

            // ---- Join room -------------------------------------------------------
            let clients = rooms.get(roomId);
            if (!clients) {
                clients = new Set();
                rooms.set(roomId, clients);
            }
            clients.add(socket);

            const roomState = getRoomState(roomId);
            const connCtx = {
                roomId,
                candidateId,
                jobId,
                interviewScheduleId,
                peerId: queryPeerId || null,
                userAgent,
                ip,
                signalCounts: {}
            };

            fastify.log.info(
                { roomId, clients: clients.size },
                '[WS] New WebSocket client joined room'
            );

            persistEvent(req, {
                roomId,
                candidateId,
                jobId,
                interviewScheduleId,
                peerId: connCtx.peerId,
                eventType: 'ws_connected',
                details: { clients: clients.size },
                userAgent,
                ip
            });

            // ---- Incoming signaling messages ------------------------------------
            socket.on('message', (raw) => {
                let msg;
                try {
                    msg = JSON.parse(raw.toString());
                } catch (err) {
                    fastify.log.error(
                        { err, raw: raw.toString() },
                        '[WS] Invalid JSON message from client'
                    );
                    return;
                }

                const msgType = msg?.type || 'unknown';
                if (!connCtx.peerId && (msg?.from || msg?.peerId)) {
                    connCtx.peerId = msg?.from || msg?.peerId;
                }

                if (connCtx.peerId) {
                    const entry = roomState.participants.get(connCtx.peerId) || {
                        peerId: connCtx.peerId,
                        joinedAt: new Date(),
                        lastSeenAt: new Date(),
                        userAgent,
                        ip
                    };
                    entry.lastSeenAt = new Date();
                    roomState.participants.set(connCtx.peerId, entry);
                }

                if (msgType === 'join' && connCtx.peerId) {
                    persistEvent(req, {
                        roomId,
                        candidateId,
                        jobId,
                        interviewScheduleId,
                        peerId: connCtx.peerId,
                        eventType: 'peer_joined',
                        details: { from: connCtx.peerId },
                        userAgent,
                        ip
                    });
                    broadcastRoomState(roomId);
                } else if (msgType === 'leave' && connCtx.peerId) {
                    roomState.participants.delete(connCtx.peerId);
                    persistEvent(req, {
                        roomId,
                        candidateId,
                        jobId,
                        interviewScheduleId,
                        peerId: connCtx.peerId,
                        eventType: 'peer_left',
                        details: { from: connCtx.peerId },
                        userAgent,
                        ip
                    });
                    broadcastRoomState(roomId);
                } else {
                    connCtx.signalCounts[msgType] =
                        (connCtx.signalCounts[msgType] || 0) + 1;
                }

                // Broadcast signaling message to all other peers in this room
                for (const client of clients) {
                    if (client === socket) continue;
                    if (client.readyState === client.OPEN) {
                        try {
                            client.send(JSON.stringify(msg));
                        } catch (err) {
                            fastify.log.error(
                                { err, roomId },
                                '[WS] Error sending message to peer'
                            );
                        }
                    }
                }
            });

            // ---- Handle disconnect ----------------------------------------------
            socket.on('close', (code, reason) => {
                clients.delete(socket);
                if (connCtx.peerId) {
                    roomState.participants.delete(connCtx.peerId);
                }

                fastify.log.info(
                    {
                        roomId,
                        clients: clients.size,
                        code,
                        reason: reason?.toString()
                    },
                    '[WS] WebSocket client left room'
                );

                persistEvent(req, {
                    roomId,
                    candidateId,
                    jobId,
                    interviewScheduleId,
                    peerId: connCtx.peerId,
                    eventType: 'ws_disconnected',
                    details: {
                        code,
                        reason: reason?.toString() || null,
                        signalCounts: connCtx.signalCounts
                    },
                    userAgent,
                    ip
                });

                broadcastRoomState(roomId);

                if (clients.size === 0) {
                    rooms.delete(roomId);
                    roomStates.delete(roomId);
                }
            });

            // ---- Handle low-level errors ----------------------------------------
            socket.on('error', (err) => {
                fastify.log.error({ err, roomId }, '[WS] WebSocket error');
                persistEvent(req, {
                    roomId,
                    candidateId,
                    jobId,
                    interviewScheduleId,
                    peerId: connCtx.peerId,
                    eventType: 'ws_error',
                    details: { message: err?.message || err },
                    userAgent,
                    ip
                });
            });
        }
    );
}

// Export as Fastify plugin
export default fp(webrtcRoomRoutes);
