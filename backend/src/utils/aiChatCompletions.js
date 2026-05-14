// backend\src\utils\aiChatCompletions.js
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { loadKeysConfigFromDB } from './dbUtils.js';

dotenv.config();

const getLogger = (req) => {
    const logger = req?.log;
    return {
        info: typeof logger?.info === 'function' ? logger.info.bind(logger) : console.log,
        warn: typeof logger?.warn === 'function' ? logger.warn.bind(logger) : console.warn,
        error: typeof logger?.error === 'function' ? logger.error.bind(logger) : console.error
    };
};

const formatOpenAIError = (err) => ({
    name: err?.name || undefined,
    message: err?.message || String(err),
    status: err?.status || err?.statusCode || err?.code || undefined,
    type: err?.type || undefined
});

export async function loadOpenAIConfigFromDB(req) {
    const log = getLogger(req);
    let cfg;
    try {
        cfg = await loadKeysConfigFromDB({ $in: ['AI'] }, 'OpenAI', req);
    } catch (error) {
        log.error('[OpenAI] Config load failed (DB):', formatOpenAIError(error));
        throw error;
    }

    if (cfg?.configurationDetails?.apiKey) {
        const { apiKey, model = 'gpt-5-nano', temperature = 0 } = cfg.configurationDetails;
        return { apiKey, model, temperature: Number(temperature) };
    }

    if (process.env.OPENAI_API_KEY) {
        return {
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-5-nano',
            temperature: Number(process.env.OPENAI_TEMPERATURE) || 0
        };
    }

    const missingKeyError = new Error(
        'No OpenAI API key found in database or environment variables'
    );
    log.error('[OpenAI] API key missing:', formatOpenAIError(missingKeyError));
    throw missingKeyError;
}

export async function getOpenAIClient(apiKey) {
    let _openAIClient = new OpenAI({ apiKey });
    return _openAIClient;
}

export async function chatCompletionByOpenAI(
    messages,
    req,
    temperatureOverride = null,
    givenConfig = null,
    givenModel = null
) {
    const log = getLogger(req);
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('`messages` must be a non-empty array');
    }

    const { apiKey, model } = givenConfig && typeof givenConfig === 'object' ? (Object.keys(givenConfig)?.length > 0 ? givenConfig : await loadOpenAIConfigFromDB(req)) : await loadOpenAIConfigFromDB(req);
    const temperature = temperatureOverride !== null ? temperatureOverride : 1;

    let client;
    try {
        client = await getOpenAIClient(apiKey);
    } catch (error) {
        log.error('[OpenAI] Client initialization failed:', formatOpenAIError(error));
        throw error;
    }

    try {
        return await client.chat.completions.create({
            model: givenModel ? givenModel : model,
            temperature,
            messages
        });
    } catch (err) {
        log.error('[OpenAI] Chat completion failed:', formatOpenAIError(err));
    }
}