import { AiAgentAssistant } from "../ai/aiAssistantAgent.js";

export async function aiAgentAssistantRoutesWithoutAuth(fastify) {
    fastify.get("assistant/:id/", { websocket: true }, async (ws, req) => {
        if (ws) {
            const { id } = req?.params || {};

            let assistantObj;
            if (id) {
                if (id in AiAgentAssistant.allInstances) {
                    assistantObj = AiAgentAssistant.allInstances[id];
                    if (assistantObj && assistantObj.aiAgentInputArray?.length > 0) {
                        ws.send(
                            JSON.stringify({
                                event: "historyRetrival",
                                history: assistantObj.aiAgentInputArray.filter(ele => ele?.role?.toLowerCase?.() !== "system"),
                            })
                        );

                    }
                } else {
                    console.log("❌ Error assistant id does not have any instance of AiAgentAssistant.\n id: ", id);
                    return;
                }

                const setWs = assistantObj.setWs.bind(assistantObj);
                setWs(ws);

                ws.on('message', assistantObj.wsMsgHandler.bind(assistantObj));
                ws.on('close', assistantObj.wsOnCloseHandler.bind(assistantObj));

            } else {
                ws.send(
                    JSON.stringify({
                        event: "error",
                        ok: false,
                        code: 401,
                        message: "Unauthuorized, as user id not found...",
                    })
                );
            }

        } else {
            console.log("❌ ws is not defined...", "\n ws: ", ws);
        }
    });
}

export async function aiAgentAssistantRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.post("assistant/create/chat/", async (req, reply) => {
        const id = req?.user?._id || req?.user?.sub;
        if (!(id in AiAgentAssistant.allInstances)) {
            const obj = new AiAgentAssistant(req);
            return reply.code(201).send("AI Agent Assistant Session created successfully...");
        } else if (id in AiAgentAssistant.allInstances) {
            if (!AiAgentAssistant.allInstances[id]) {
                const obj = new AiAgentAssistant(req);
                return reply.code(201).send("AI Agent Assistant Session created successfully...");
            } else {
                return reply.code(200).send("AI Agent Assistant Session already created...");
            }
        } else if (!id) {
            return reply.code(400).send("Unauthorized, as user id not found...");
        }
    });
}
