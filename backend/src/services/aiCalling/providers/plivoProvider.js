import { Client as PlivoClient } from "plivo";
import { loadKeysConfigFromDB } from "../../../utils/dbUtils.js";

let plivoClient = null;
let roundRobinLastIndex = 0;

const loadPlivoKeys = async (req) => {
    let cfg = await loadKeysConfigFromDB('Telephony', 'Plivo', req);

    if (cfg?.configurationDetails?.authId && cfg.configurationDetails?.authToken) {
        const { authId, authToken } = cfg.configurationDetails;
        return { authId, authToken };
    }

    if (process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN) {
        return {
            authId: process.env.PLIVO_AUTH_ID,
            authToken: process.env.PLIVO_AUTH_TOKEN
        };
    }

    throw new Error("No Plivo keys found in database or environment variables");
};

export const ensurePlivoClient = async (req) => {
    if (plivoClient) return plivoClient;
    const { authId, authToken } = await loadPlivoKeys(req);
    plivoClient = new PlivoClient(authId, authToken);
    return plivoClient;
};

export const getPlivoClient = () => plivoClient;

export const createPlivoCall = async ({ req, toNumber, answerUrl, hangupUrl }) => {
    const client = await ensurePlivoClient(req);
    const plivoNumberList = await client.numbers.list({});

    if (!plivoNumberList.length) {
        throw new Error("No Plivo numbers found in your account");
    }

    const nextIndex = (roundRobinLastIndex + 1) % plivoNumberList.length;
    const fromNumber = plivoNumberList[nextIndex].number;

    const callCreationRes = await client.calls.create(
        fromNumber,
        toNumber,
        answerUrl,
        {
            answerMethod: "POST",
            machineDetection: "false",
            hangupUrl,
            hangupMethod: "POST"
        }
    );

    roundRobinLastIndex = nextIndex;

    return {
        callUUID: callCreationRes?.requestUuid || null,
        fromNumber,
    };
};

export const hangupPlivo = async (callUUID, req = null) => {
    if (!callUUID) return;
    const client = await ensurePlivoClient(req);
    await client?.calls?.hangup?.(callUUID);
};

export const buildPlivoOutboundMediaMessage = ({
    audioBuffer,
    audioText = null,
    contentType,
    sampleRate,
    callUUID
}) => {
    const contMedia = {
        contentType,
        sampleRate,
        track: 'outbound',
        payload: audioBuffer?.toString?.('base64') || '',
    };

    if (callUUID?.includes?.("call_simulation") && audioText) {
        contMedia.audioText = audioText;
    }

    return JSON.stringify({
        event: 'playAudio',
        media: contMedia,
    });
};

export const buildPlivoClearAudioMessage = (callUUID) => JSON.stringify({
    event: 'clearAudio',
    callId: callUUID,
});

const plivoProvider = {
    name: "plivo",
    wsProtocol: "plivo",
    ensureClient: ensurePlivoClient,
    createCall: createPlivoCall,
    hangup: hangupPlivo,
    buildOutboundMediaMessage: buildPlivoOutboundMediaMessage,
    buildClearAudioMessage: buildPlivoClearAudioMessage,
};

export default plivoProvider;
