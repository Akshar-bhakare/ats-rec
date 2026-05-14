// backend/src/utils/aiGeminiCompletions.js

import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadKeysConfigFromDB } from './dbUtils.js';

dotenv.config();

/* ================================================================
   1. Load Gemini configuration (DB → ENV fallback)
================================================================ */
export async function loadGeminiConfig(req) {
    console.log("🔍 [Gemini] Loading configuration...");

    try {
        const savedConfig = await loadKeysConfigFromDB(
            { $in: ['AI'] },
            'Gemini',
            req
        );

        if (savedConfig?.configurationDetails?.apiKey) {
            console.log("✅ [Gemini] Loaded config from DB");

            const {
                apiKey,
                model = 'gemini-2.0-flash',
                temperature = 0
            } = savedConfig.configurationDetails;

            return {
                apiKey,
                model,
                temperature: Number(temperature)
            };
        }

        console.log("⚠️ [Gemini] No DB config found. Checking ENV...");

        if (process.env.GEMINI_API_KEY) {
            console.log("✅ [Gemini] Loaded config from ENV");

            return {
                apiKey: process.env.GEMINI_API_KEY,
                model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
                temperature: Number(process.env.GEMINI_TEMPERATURE) || 0
            };
        }

        throw new Error("Gemini API key missing in DB and ENV.");

    } catch (error) {
        console.log("❌ [Gemini] Config Load Error:", error);
        throw error;
    }
}

/* ================================================================
   2. Initialize Gemini API client
================================================================ */
export function createGeminiClient(apiKey) {
    console.log("🔧 [Gemini] Initializing Gemini Client...");
    return new GoogleGenerativeAI(apiKey);
}

/* ================================================================
   3. Unified Chat Completion Function (OpenAI-style output)
================================================================ */
export async function geminiChatCompletion(
    messages,
    req,
    temperatureOverride = null,
    overrideConfig = null,
    overrideModel = null
) {
    console.log("\n==================== GEMINI REQUEST START ====================\n");

    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("`messages` must be a non-empty array.");
    }

    console.log("📝 [Gemini] Input Messages:", JSON.stringify(messages, null, 2));

    /* Load model/API config */
    const config =
        overrideConfig && Object.keys(overrideConfig).length > 0
            ? overrideConfig
            : await loadGeminiConfig(req);

    const apiKey = config.apiKey;
    const modelName = overrideModel || config.model;
    const temperature = temperatureOverride !== null
        ? temperatureOverride
        : config.temperature;

    console.log("⚙️ [Gemini] Model:", modelName);
    console.log("🌡️ [Gemini] Temperature:", temperature);

    /* Prepare prompt */
    const prompt = messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

    console.log("🧠 [Gemini] Prompt Sent:\n", prompt);

    try {
        const client = createGeminiClient(apiKey);
        const model = client.getGenerativeModel({ model: modelName });

        console.log("🚀 [Gemini] Generating content...");

        const response = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: { temperature }
        });

        console.log("📥 [Gemini] Raw Response:", JSON.stringify(response, null, 2));

        const output =
            response?.response?.text()?.trim() ||
            "";

        console.log("📤 [Gemini] Extracted Output:", output);

        /* Return in OpenAI-style structure */
        const formattedResponse = {
            id: "gemini-response",
            object: "chat.completion",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: output
                    }
                }
            ]
        };

        console.log("🎯 [Gemini] Formatted Response:", JSON.stringify(formattedResponse, null, 2));
        console.log("\n==================== GEMINI REQUEST END ====================\n");

        return formattedResponse;

    } catch (error) {
        console.log("❌ [Gemini] Chat Completion Error:", error);

        return {
            id: "gemini-response-error",
            choices: [{ message: { content: "" } }],
            error: error?.message || "Unknown Gemini error"
        };
    }
}
