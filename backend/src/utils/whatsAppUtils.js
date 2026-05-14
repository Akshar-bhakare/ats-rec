import dotenv from 'dotenv';

import { getClientDbConn } from "./clientDbUtils.js";


dotenv.config();
const isDevEnv = ["local", "development"].includes(process.env?.NODE_ENV);
const defaultTemplateLanguage = process.env?.WHATSAPP_TEMPLATE_LANGUAGE_CODE || "en_US";
// const defaultPhoneNumberId = process.env?.WHATSAPP_PHONE_NUMBER_ID;
export default class WhatsAppUtils {

    constructor(config) {
        this.phoneNumberId = config.phoneNumberId;
        this.token = config.token;
        this.verifyToken = config.verifyToken;
        this.apiVersion = config.apiVersion || "v18.0";

    }

    async getBaseUrl(clientOrId) {
        if (clientOrId) {
            let client;
            if (typeof clientOrId === "string") {
                const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
                client = await globalConn.models.ClientAdmin.findOne({ client: clientOrId }).lean().exec();
                if (!client) client = await globalConn.models.ClientAdmin.findOne({ user: clientOrId }).lean().exec();
                if (!client) client = await globalConn.models.ClientAdmin.findOne({ _id: clientOrId }).lean().exec();
                if (!client) throw new Error("Invalid client id: " + clientOrId);
            } else {
                client = clientOrId;
            }

            if (client?.aiSelektWaId) {
                return { url: `https://graph.facebook.com/${this.apiVersion}/${client.aiSelektWaId}/messages`, client, };
            }
        }

        const fallbackPhoneNumberId = this.phoneNumberId; // || defaultPhoneNumberId;
        return { url: `https://graph.facebook.com/${this.apiVersion}/${fallbackPhoneNumberId}/messages`, client: undefined, };
    }

    async sendTextMessage(to, message, clientOrId, sentByService = undefined, nextActionExpected = undefined) {
        isDevEnv && console.log(
            "1) WhatsAppUtils:: sendTextMessage: ", to, message
        );

        try {
            const payload = {
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: message }
            };

            const baseUrl = await this.getBaseUrl(clientOrId);
            const client = baseUrl?.client;

            isDevEnv && console.log(
                "2) WhatsAppUtils:: sendTextMessage: ", baseUrl
            );

            isDevEnv && console.log(
                "3) WhatsAppUtils:: sendTextMessage: ", payload
            );
            const response = await fetch(baseUrl?.url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            isDevEnv && console.log(
                "4) WhatsAppUtils:: sendTextMessage: ", data
            );
            if (!response.ok) {
                return { success: false, error: data };
            }

            try {
                if (client) {
                    const clientConn = await getClientDbConn(client.clientCompany);

                    await clientConn.models.WhatsAppMessage.create({
                        waId: to,
                        systemId: client?.aiSelektWaId || this.phoneNumberId, // || defaultPhoneNumberId,
                        direction: "outbound",
                        message: message,
                        messageId: data?.messages?.[0]?.id || null,
                        waTimestamp: Date.now(),
                        sentByService,
                        nextActionExpected,
                        client: client?.client,
                    });
                }

            } catch (err) {
                console.log(
                    " Error in saving outgoing whatsapp msg in db: ", err
                );

            }

            return {
                success: true,
                messageId: data.messages?.[0]?.id || null,
                raw: data
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async sendTemplateMessage(to, templateName, options = {}) {
        const {
            languageCode = defaultTemplateLanguage,
            variables = [],
            components = undefined,
            clientOrId,
            sentByService = "WhatsApp API",
            nextActionExpected = undefined,
            recipientType = "individual",
        } = options || {};

        if (!to) return { success: false, error: "Recipient phone number is required for template messages." };
        if (!templateName) return { success: false, error: "Template name is required for template messages." };

        const providedComponents = Array.isArray(components)
            ? components.filter(Boolean)
            : (components ? [components] : undefined);

        const normalizedComponents = providedComponents?.length ? [...providedComponents] : [];

        const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);

        const normalizeParamValue = (value, inferredName) => {
            if (value && typeof value === "object" && value.type) {
                const param = { ...value };
                // const providedName = param.parameter_name || param.parameterName || param.name;
                // if (providedName && !param.parameter_name) {
                //     param.parameter_name = providedName;
                // } else if (!providedName && inferredName) {
                //     param.parameter_name = inferredName;
                // }

                if (param.type === "text") {
                    if (param.text === undefined && param.value !== undefined) {
                        param.text = String(param.value ?? "");
                        delete param.value;
                    } else {
                        param.text = String(param.text ?? "");
                    }
                }

                return param;
            }

            const param = {
                type: "text",
                text: value === undefined || value === null ? "" : String(value),
            };

            // if (inferredName) {
            //     param.parameter_name = inferredName;
            // }

            return param;
        };

        const buildParameters = (source, defaultNamePrefix) => {
            if (source === undefined || source === null) return [];

            if (Array.isArray(source)) {
                return source.map((entry, idx) => normalizeParamValue(entry, defaultNamePrefix ? `${defaultNamePrefix}_${idx + 1}` : undefined));
            }

            if (isPlainObject(source) && !source.type) {
                return Object.entries(source).map(([paramName, paramValue]) => normalizeParamValue(paramValue, paramName));
            }

            return [normalizeParamValue(source, defaultNamePrefix ? `${defaultNamePrefix}_1` : undefined)];
        };

        const pushComponent = (type, params, extra = {}) => {
            if (!params?.length) return;
            const normalizedType = typeof type === "string" ? type : undefined;
            normalizedComponents.push({
                ...(normalizedType ? { type: normalizedType } : {}),
                parameters: params,
                ...extra,
            });
        };

        if (!providedComponents?.length) {
            if (Array.isArray(variables) && variables.length) {
                pushComponent("body", buildParameters(variables));
            } else if (variables && typeof variables === "object") {
                const hasKnownKeys = ["body", "header", "buttons"].some((key) => variables[key]);
                if (hasKnownKeys) {
                    if (variables.header) {
                        pushComponent("header", buildParameters(variables.header));
                    }
                    if (variables.body) {
                        pushComponent("body", buildParameters(variables.body));
                    }
                    const buttonEntries = Array.isArray(variables.buttons)
                        ? variables.buttons
                        : (variables.buttons ? [variables.buttons] : []);

                    buttonEntries.forEach((buttonConfig, idx) => {
                        if (!buttonConfig) return;
                        const buttonParamsSource = buttonConfig.parameters || buttonConfig.values || buttonConfig.body || buttonConfig;
                        const buttonParams = buildParameters(buttonParamsSource);
                        if (!buttonParams.length) return;

                        pushComponent("button", buttonParams, {
                            sub_type: buttonConfig.sub_type || "quick_reply",
                            index: typeof buttonConfig.index === "number"
                                ? buttonConfig.index.toString()
                                : (buttonConfig.index || `${idx}`),
                        });
                    });
                } else {
                    pushComponent("body", buildParameters(variables));
                }
            }
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: recipientType,
            to,
            type: "template",
            template: {
                name: templateName,
                language: { code: languageCode },
            },
        };

        if (normalizedComponents.length) {
            payload.template.components = normalizedComponents;
        }

        isDevEnv && console.log(
            "1) WhatsAppUtils:: sendTemplateMessage: ", payload, "\n", JSON.stringify(payload),
        );

        try {
            const baseUrl = await this.getBaseUrl(clientOrId);
            const client = baseUrl?.client;

            isDevEnv && console.log(
                "2) WhatsAppUtils:: sendTemplateMessage: ", baseUrl?.url
            );

            const response = await fetch(baseUrl?.url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            isDevEnv && console.log(
                "3) WhatsAppUtils:: sendTemplateMessage: ", data
            );

            if (!response.ok) {
                return { success: false, error: data };
            }

            try {
                if (client) {
                    const clientConn = await getClientDbConn(client.clientCompany);
                    const messageLog = JSON.stringify({
                        type: "template",
                        name: templateName,
                        languageCode,
                        variables,
                        components: normalizedComponents,
                    });

                    await clientConn.models.WhatsAppMessage.create({
                        waId: to,
                        systemId: client?.aiSelektWaId || this.phoneNumberId, // || defaultPhoneNumberId,
                        direction: "outbound",
                        message: messageLog,
                        messageId: data?.messages?.[0]?.id || null,
                        waTimestamp: Date.now(),
                        sentByService,
                        nextActionExpected,
                        client: client?.client,
                    });
                }

            } catch (err) {
                console.log(
                    " Error in saving outgoing whatsapp template msg in db: ", err
                );

            }

            return {
                success: true,
                messageId: data.messages?.[0]?.id || null,
                raw: data
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    verifyWebhook(query) {
        const mode = query["hub.mode"];
        const token = query["hub.verify_token"];
        const challenge = query["hub.challenge"];

        if (mode === "subscribe" && token === this.verifyToken) {
            return { verified: true, challenge };
        }
        return { verified: false };
    }

    parseIncomingMessage(body) {
        try {
            const entry = body.entry?.[0];
            const change = entry?.changes?.[0]?.value;

            if (!change?.messages) return null;

            const msg = change.messages[0];
            const contact = change.contacts?.[0];

            return {
                ...msg,
                ...contact,
                from: contact?.wa_id,
                name: contact?.profile?.name || null,
                type: msg.type,
                message: msg.text?.body || null,
                timestamp: msg.timestamp,
                raw: msg,
                forSystem: change.metadata.phone_number_id,
            };
        } catch {
            return null;
        }
    }

    async autoReply(incoming, text, clientOrId) {
        if (!incoming?.from) return null;
        // return this.sendTextMessage(incoming.from, text, clientOrId, "Ai Selekt Auto Reply");
        console.log("💬 Auto replying to the user (" + incoming?.from + ") by template 'initial_msg_v2'...");
        return this.sendTemplateMessage(incoming.from, "initial_msg_v2", { clientOrId, sentByService: "Ai Selekt Auto Reply" });
    }
}






