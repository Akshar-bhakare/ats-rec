import { AiCallManager } from "../services/aiCalling/aiCallOrchestrationV2.js";
import { getClientDbConn, resolveDbNameByClientId } from "../utils/clientDbUtils.js";

export default async function WhatsAppRoutes(fastify) {

    // Verify Webhook
    fastify.get("/webhook", async (req, reply) => {
        const result = fastify.whatsapp.verifyWebhook(req.query);

        if (result.verified) return reply.send(result.challenge);

        return reply.status(403).send("Verification failed.");
    });

    // Receive Messages
    fastify.post("/webhook", async (req, reply) => {
        const incoming = fastify.whatsapp.parseIncomingMessage(req.body);

        let client;
        const defaultSystemId = fastify.whatsapp?.phoneNumberId; // || process.env.WHATSAPP_PHONE_NUMBER_ID;
        try {
            const conn = await getClientDbConn(process?.env?.DEFAULT_DB_NAME);
            const systemId = incoming?.forSystem; // || defaultSystemId;
            if (systemId) {
                client = await conn.models.ClientAdmin.findOne({ aiSelektWaId: systemId }).lean().exec();
            }
        } catch (err) {
            console.log(
                "Error in identifying client: ", err
            );

        }

        if (incoming) {
            try {
                if (client) {
                    const clientConn = await getClientDbConn(client.clientCompany);

                    const systemId = incoming?.forSystem; // || defaultSystemId;
                    clientConn.models.WhatsAppMessage.create({
                        waId: incoming.from,
                        systemId,
                        direction: "inbound",
                        message: incoming.message,
                        messageId: incoming.raw.id,
                        waTimestamp: incoming.timestamp || Date.now(),
                        sentByService: "WhatsApp API",
                        client: client?.client,
                    })
                        .catch((err) => {
                            fastify.log.error({
                                ok: false,
                                code: 400,
                                message: "Error in saving incoming whatsapp msg in db...",
                                details: {
                                    error: err,
                                }
                            });
                        });

                    const prevMsg_ = await clientConn.models.WhatsAppMessage.find({
                        waId: incoming.from,
                        systemId,
                        direction: "outbound",
                    })
                        .sort({
                            createdAt: -1
                        })
                        .limit(1)
                        .lean()
                        .exec();

                    const prevMsg = prevMsg_?.[0];

                    switch (prevMsg?.sentByService) {
                        case "AI Screening Call":
                            try {
                                if (prevMsg?.nextActionExpected?.includes?.("Reply to conversation: ")) {
                                    const waUUID = prevMsg?.nextActionExpected?.replace("Reply to conversation: ", "");
                                    const conv = await clientConn.models.Conversation.findOne({
                                        callUUID: waUUID,
                                    })
                                        .lean()
                                        .exec();

                                    if (conv?.candidateId && conv?.jobId) {
                                        const AiCallObjKey = `${conv?.candidateId}, ${conv?.jobId}`;

                                        req.client = conv.client;
                                        req.dbName = await resolveDbNameByClientId(req.client);
                                        req.conn = await getClientDbConn(req.dbName);

                                        let AiCallObj = AiCallManager.allInstances[AiCallObjKey];
                                        if (!AiCallObj) {
                                            AiCallObj = new AiCallManager();

                                            const initRes = await AiCallObj.init(conv?.candidateId, conv?.jobId, req);
                                            if (!initRes || !initRes?.ok) {
                                                throw new Error(initRes?.message || 'Initial conversation setup failed...');
                                            }

                                            AiCallManager.allInstances[AiCallObjKey] = AiCallObj;
                                        }

                                        const aiResponse = await AiCallObj.onWhatsAppMessage(incoming.message);
                                        fastify.whatsapp.sendTextMessage(incoming.from, aiResponse, client, "AI Screening Call", aiResponse.toLowerCase().includes("goodbye") ? "Ai Selekt Auto Reply" : prevMsg?.nextActionExpected)
                                        break;

                                    }

                                }
                            } catch (err) {
                                console.log(
                                    "Error in processing received WhatsApp msg again call conv: ", err
                                );

                            }

                        default:
                            // Example auto-reply logic
                            fastify.whatsapp.autoReply(incoming, "Hirex REC: Your Message received. We will get back to you soon.", client);
                            break;
                    }

                }

            } catch (err) {
                console.log(
                    " Error in WhatsApp conversation: ", err
                );

            }
            fastify.log.info({ incoming }, "Incoming WhatsApp message webhook payload...");

        }

        return reply.send({ status: "success" });
    });

    if (['development', 'local'].includes(process?.env?.NODE_ENV)) {
        fastify.get("/test/integration", async (req, reply) => {
            fastify.whatsapp.sendTextMessage("+919075886735", "Ai Selekt testing...");

            return reply.status(200).send("Testing done.");
        });
    }

}
