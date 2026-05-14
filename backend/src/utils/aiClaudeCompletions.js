// backend/src/utils/aiClaudeCompletions.js
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { loadKeysConfigFromDB } from './dbUtils.js';

dotenv.config();

const DEFAULTS = {
    model: 'claude-sonnet-4-5-20250929', // repo example default
    temperature: 0,
    maxTokens: 1024,
};

/* ================================================================
   1. Load Claude configuration (DB → ENV fallback)
================================================================ */
export async function loadClaudeConfig(req) {
    console.log('🔍 [Claude] Loading configuration...');

    try {
        const savedConfig = await loadKeysConfigFromDB(
            { $in: ['AI'] },
            'Claude',
            req
        );

        if (savedConfig?.configurationDetails?.apiKey) {
            console.log('✅ [Claude] Loaded config from DB');

            const {
                apiKey,
                model = DEFAULTS.model,
                temperature = DEFAULTS.temperature,
                maxTokens = DEFAULTS.maxTokens,
            } = savedConfig.configurationDetails;

            return {
                apiKey,
                model,
                temperature: Number(temperature),
                maxTokens: Number(maxTokens) || DEFAULTS.maxTokens,
            };
        }

        console.log('⚠️ [Claude] No DB config found. Checking ENV...');

        const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY; // support both
        if (apiKey) {
            console.log('✅ [Claude] Loaded config from ENV');

            return {
                apiKey,
                model: process.env.CLAUDE_MODEL || DEFAULTS.model,
                temperature: Number(process.env.CLAUDE_TEMPERATURE) || DEFAULTS.temperature,
                maxTokens: Number(process.env.CLAUDE_MAX_TOKENS) || DEFAULTS.maxTokens,
            };
        }

        throw new Error('Claude API key missing in DB and ENV.');
    } catch (error) {
        console.log('❌ [Claude] Config Load Error:', error);
        throw error;
    }
}

/* ================================================================
   2. Initialize Claude API client
================================================================ */
export function createClaudeClient(apiKey) {
    console.log('🔧 [Claude] Initializing Claude Client...');
    // Anthropic SDK accepts apiKey (defaults to ANTHROPIC_API_KEY if omitted)
    return new Anthropic({ apiKey });
}

/* ================================================================
   3. Unified Chat Completion Function (OpenAI-style output)
================================================================ */
export async function claudeChatCompletion(
    messages,
    req,
    temperatureOverride = null,
    overrideConfig = null,
    overrideModel = null
) {
    console.log('\n==================== CLAUDE REQUEST START ====================\n');

    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('`messages` must be a non-empty array.');
    }

    console.log('📝 [Claude] Input Messages:', JSON.stringify(messages, null, 2));

    /* Load model/API config */
    const config =
        overrideConfig && Object.keys(overrideConfig).length > 0
            ? overrideConfig
            : await loadClaudeConfig(req);

    const apiKey = config.apiKey;
    const modelName = overrideModel || config.model;

    const temperature =
        temperatureOverride !== null ? temperatureOverride : config.temperature;

    const maxTokens = Number(config.maxTokens) || DEFAULTS.maxTokens;

    console.log('⚙️ [Claude] Model:', modelName);
    console.log('🌡️ [Claude] Temperature:', temperature);
    console.log('🧮 [Claude] Max Tokens:', maxTokens);

    // Anthropic supports a dedicated system field
    const systemMessages = messages.filter((m) => m?.role === 'system' && m?.content);
    const system =
        systemMessages.length > 0
            ? systemMessages.map((m) => String(m.content)).join('\n\n')
            : undefined;

    // Convert to Anthropic Messages API format (user/assistant only)
    let anthropicMessages = messages
        .filter((m) => m && m.role && m.content && m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content),
        }));

    // ✅ SAFETY GUARD: Anthropic requires at least one message
    if (!anthropicMessages.length) {
        console.log('⚠️ [Claude] No user/assistant messages provided. Injecting a default user message to satisfy Anthropic API.');

        anthropicMessages = [
            {
                role: 'user',
                content: 'Follow the system instructions exactly.',
            },
        ];
    }

    console.log('🧠 [Claude] System Prompt:\n', system || '(none)');
    console.log('📦 [Claude] Messages Sent:', JSON.stringify(anthropicMessages, null, 2));

    try {
        const client = createClaudeClient(apiKey);

        console.log('🚀 [Claude] Creating message...');

        const response = await client.messages.create({
            model: modelName,
            max_tokens: maxTokens,
            temperature,
            ...(system ? { system } : {}),
            messages: anthropicMessages,
        });

        console.log('📥 [Claude] Raw Response:', JSON.stringify(response, null, 2));

        // Claude returns an array of content blocks; text blocks contain .text
        const output =
            Array.isArray(response?.content)
                ? response.content
                    .filter((b) => b?.type === 'text' && typeof b?.text === 'string')
                    .map((b) => b.text)
                    .join('\n')
                    .trim()
                : '';

        console.log('📤 [Claude] Extracted Output:', output);

        /* Return in OpenAI-style structure */
        const formattedResponse = {
            id: 'claude-response',
            object: 'chat.completion',
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: output,
                    },
                },
            ],
        };

        console.log('🎯 [Claude] Formatted Response:', JSON.stringify(formattedResponse, null, 2));
        console.log('\n==================== CLAUDE REQUEST END ====================\n');

        return formattedResponse;
    } catch (error) {
        console.log('❌ [Claude] Chat Completion Error:', error);

        return {
            id: 'claude-response-error',
            choices: [{ message: { content: '' } }],
            error: error?.message || 'Unknown Claude error',
        };
    }
}
