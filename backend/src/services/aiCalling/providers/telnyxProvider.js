import axios from "axios";
import { loadKeysConfigFromDB } from "../../../utils/dbUtils.js";

let telnyxConfig = null;

const loadTelnyxConfig = async (req) => {
    let cfg = null;
    try {
        cfg = await loadKeysConfigFromDB('Telephony', 'Telnyx', req);
    } catch {
        cfg = null;
    }

    const details = cfg?.configurationDetails || {};
    const apiKey = details.apiKey || details.authToken || process.env.TELNYX_API_KEY;
    const phoneNumber = details.phoneNumber || details.fromNumber || process.env.TELNYX_PHONE_NUMBER;
    const connectionId = details.connectionId || process.env.TELNYX_CONNECTION_ID;
    const apiBaseUrl = details.apiBaseUrl || process.env.TELNYX_API_BASE_URL || "https://api.telnyx.com/v2";

    if (!apiKey || !phoneNumber || !connectionId) {
        throw new Error("Missing Telnyx configuration (TELNYX_API_KEY, TELNYX_PHONE_NUMBER, TELNYX_CONNECTION_ID).");
    }

    return { apiKey, phoneNumber, connectionId, apiBaseUrl };
};

export const ensureTelnyxConfig = async (req) => {
    if (telnyxConfig) return telnyxConfig;
    telnyxConfig = await loadTelnyxConfig(req);
    return telnyxConfig;
};

export const telnyxRequest = async ({ path, method = "POST", data = null, req = null }) => {
    const cfg = await ensureTelnyxConfig(req);
    const url = `${cfg.apiBaseUrl}${path}`;
    try {
        const res = await axios({
            method,
            url,
            data,
            headers: {
                Authorization: `Bearer ${cfg.apiKey}`,
                "Content-Type": "application/json",
            },
            timeout: 15000,
        });
        return res?.data;
    } catch (err) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        console.log(`[Telnyx] Request failed: ${method} ${path} status=${status || "n/a"}`);
        if (body) {
            console.log(`[Telnyx] Error body:`, body);
        }
        throw err;
    }
};

export const createTelnyxCall = async ({ req, toNumber, webhookUrl, clientState = null }) => {
    const cfg = await ensureTelnyxConfig(req);
    const payload = {
        connection_id: cfg.connectionId,
        to: toNumber,
        from: cfg.phoneNumber,
        webhook_url: webhookUrl,
    };
    if (clientState) payload.client_state = clientState;

    console.log(`[Telnyx] Creating outbound call`, {
        to: toNumber,
        from: cfg.phoneNumber,
        connection_id: cfg.connectionId,
        webhook_url: webhookUrl,
    });

    const res = await telnyxRequest({
        path: "/calls",
        method: "POST",
        data: payload,
        req,
    });

    const callControlId =
        res?.data?.call_control_id ||
        res?.data?.id ||
        res?.call_control_id ||
        null;

    return {
        callUUID: callControlId,
        fromNumber: cfg.phoneNumber,
        response: res,
    };
};

export const startTelnyxStreaming = async ({ req, callControlId, streamUrl, sampleRate }) => {
    if (!callControlId) {
        throw new Error("Missing Telnyx call_control_id for streaming_start.");
    }

    const payload = {
        stream_url: streamUrl,
        stream_track: "inbound_track",
        stream_bidirectional_mode: "rtp",
        stream_bidirectional_codec: "PCMU",
        stream_bidirectional_sampling_rate: sampleRate,
    };

    console.log(`[Telnyx] Starting media stream`, {
        call_control_id: callControlId,
        stream_url: streamUrl,
        stream_track: payload.stream_track,
        bidirectional_mode: payload.stream_bidirectional_mode,
    });

    return telnyxRequest({
        path: `/calls/${callControlId}/actions/streaming_start`,
        method: "POST",
        data: payload,
        req,
    });
};

export const hangupTelnyx = async (callUUID, req = null, reason = null) => {
    if (!callUUID) return;
    const payload = reason ? { reason } : {};
    await telnyxRequest({
        path: `/calls/${callUUID}/actions/hangup`,
        method: "POST",
        data: payload,
        req,
    });
};

export const buildTelnyxOutboundMediaMessage = ({ audioBuffer }) => {
    const payload = audioBuffer?.toString?.('base64') || '';
    return JSON.stringify({
        event: 'media',
        media: { payload },
    });
};

const telnyxProvider = {
    name: "telnyx",
    wsProtocol: "telnyx",
    ensureClient: ensureTelnyxConfig,
    createCall: createTelnyxCall,
    startStreaming: startTelnyxStreaming,
    hangup: hangupTelnyx,
    buildOutboundMediaMessage: buildTelnyxOutboundMediaMessage,
};

export default telnyxProvider;
