// backend/src/utils/embeddingUtils.js

import crypto from "crypto";
import { getOpenAIClient, loadOpenAIConfigFromDB } from "./aiChatCompletions.js";

/**
 * Embedding reliability defaults (tune based on your infra + OpenAI limits)
 */
const EMBEDDING_MODEL = "text-embedding-3-large";
const MAX_INPUT_CHARS = 20000;          // pragmatic guardrail to avoid huge requests
const REQUEST_TIMEOUT_MS = 30000;       // keep the pipeline moving
const MAX_RETRIES = 3;                  // for transient + 429 only
const BASE_BACKOFF_MS = 400;

/**
 * Small helpers (kept in-file so this is a one-shot “fixed properly” implementation)
 */
function safeId(val) {
    try {
        return val ? String(val) : null;
    } catch {
        return null;
    }
}

function sha256(input) {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function normalizeText(text) {
    // Basic normalization: remove extreme whitespace noise, keep meaning
    return text.replace(/\s+/g, " ").trim();
}

function truncateIfNeeded(text) {
    if (text.length <= MAX_INPUT_CHARS) return { text, truncated: false };

    const truncatedText = text.slice(0, MAX_INPUT_CHARS);
    return { text: truncatedText, truncated: true };
}

function isFiniteNumberArray(arr) {
    return Array.isArray(arr) && arr.length > 0 && arr.every((n) => Number.isFinite(n));
}

function extractStatus(err) {
    // OpenAI SDKs and fetch errors vary. We try the common patterns.
    return (
        err?.status ??
        err?.response?.status ??
        err?.response?.statusCode ??
        err?.statusCode ??
        null
    );
}

function extractRetryAfterMs(err) {
    // If your wrapper exposes headers, great. If not, we still do backoff.
    // Common patterns: err.response.headers['retry-after'] OR err.headers
    const ra =
        err?.response?.headers?.["retry-after"] ??
        err?.headers?.["retry-after"] ??
        null;

    if (!ra) return null;

    // "retry-after" can be seconds or an HTTP date. We'll support seconds.
    const seconds = Number(ra);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

    return null;
}

function classifyEmbeddingError(err) {
    const status = extractStatus(err);
    const msg = (err?.message || "").toLowerCase();

    // Network / timeout-ish
    const isTimeout =
        msg.includes("timeout") ||
        msg.includes("timed out") ||
        msg.includes("abort") ||
        err?.name === "AbortError";

    const isNetwork =
        msg.includes("network") ||
        msg.includes("fetch") ||
        msg.includes("socket") ||
        msg.includes("econnreset") ||
        msg.includes("enotfound") ||
        msg.includes("eai_again");

    if (isTimeout) return { type: "TRANSIENT_TIMEOUT", retryable: true, status };
    if (isNetwork) return { type: "TRANSIENT_NETWORK", retryable: true, status };

    // HTTP status based
    if (status === 401) return { type: "AUTH_INVALID_KEY", retryable: false, status };
    if (status === 403) return { type: "AUTH_FORBIDDEN", retryable: false, status };
    if (status === 429) return { type: "RATE_LIMITED", retryable: true, status };
    if (status === 400) return { type: "BAD_REQUEST", retryable: false, status };
    if (status === 404) return { type: "NOT_FOUND_OR_MODEL", retryable: false, status };
    if (status === 408) return { type: "TRANSIENT_TIMEOUT", retryable: true, status };
    if (status === 500 || status === 502 || status === 503 || status === 504) {
        return { type: "TRANSIENT_UPSTREAM", retryable: true, status };
    }

    // Fallback
    return { type: "UNKNOWN", retryable: false, status };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(fn, ctx) {
    let attempt = 0;
    let lastErr = null;

    while (attempt <= MAX_RETRIES) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastErr = err;
            const meta = classifyEmbeddingError(err);

            const attemptLabel = `${attempt + 1}/${MAX_RETRIES + 1}`;
            console.error("❌ [Embedding] Attempt failed:", {
                attempt: attemptLabel,
                errorType: meta.type,
                status: meta.status,
                errorMessage: err?.message,
                user: ctx.user,
                client: ctx.client,
            });

            // No retries if not retryable OR we're out of attempts
            if (!meta.retryable || attempt >= MAX_RETRIES) break;

            // Backoff: retry-after wins, else exponential backoff with jitter
            const retryAfterMs = extractRetryAfterMs(err);
            const expBackoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
            const jitter = Math.floor(Math.random() * 200);
            const waitMs = retryAfterMs ?? expBackoff + jitter;

            console.warn("[Embedding] Retrying after backoff...", {
                waitMs,
                errorType: meta.type,
                status: meta.status,
                attemptNext: `${attempt + 2}/${MAX_RETRIES + 1}`,
                user: ctx.user,
                client: ctx.client,
            });

            await sleep(waitMs);
            attempt += 1;
        }
    }

    throw lastErr;
}

async function createEmbeddingWithTimeout(openai, input, ctx) {
    // AbortController guard so requests don’t hang forever and ruin your day
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        // The OpenAI Node SDK supports request options in newer versions.
        // If your SDK doesn’t accept { signal }, it will throw, and we’ll classify it.
        return await openai.embeddings.create(
            { model: EMBEDDING_MODEL, input },
            { signal: controller.signal }
        );
    } finally {
        clearTimeout(timeout);
    }
}

export async function generateEmbedding(text, req) {
    // 1. Guard: invalid or empty text
    if (!text || typeof text !== "string") {
        console.warn("[Embedding] Skipped embedding: invalid text payload.");
        return null;
    }

    const userId = safeId(req?.user?._id);
    const clientId = safeId(req?.client?._id);

    // Normalize and apply size guardrail
    const normalized = normalizeText(text);
    if (!normalized) {
        console.warn("[Embedding] Skipped embedding: text empty after normalization.", {
            user: userId,
            client: clientId,
        });
        return null;
    }

    const { text: finalText, truncated } = truncateIfNeeded(normalized);
    const textHash = sha256(finalText);

    console.log("[Embedding] Starting embedding generation...", {
        textLength: finalText.length,
        truncated,
        textHash, // log hash instead of leaking content
        user: userId,
        client: clientId,
        model: EMBEDDING_MODEL,
    });

    try {
        // 2. Load OpenAI config (tenant-aware)
        const cfg = await loadOpenAIConfigFromDB(req);

        const apiKey = cfg?.apiKey;
        if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
            console.error("❌ [Embedding] Missing/invalid OpenAI API key in tenant config.", {
                user: userId,
                client: clientId,
            });
            return null; // keep pipeline resilient
        }

        const openai = await getOpenAIClient(apiKey);

        console.log("[Embedding] OpenAI client initialized successfully.", {
            user: userId,
            client: clientId,
        });

        // 3. Generate embedding (with retries + timeout)
        const ctx = { user: userId, client: clientId };

        const result = await withRetries(
            async () => createEmbeddingWithTimeout(openai, finalText, ctx),
            ctx
        );

        const vector = result?.data?.[0]?.embedding;

        // --- Log embedding cost from OpenAI usage ---
        const usage = result?.usage;
        if (usage) {
            const promptTokens = usage.prompt_tokens ?? 0;
            const totalTokens = usage.total_tokens ?? 0;
            // text-embedding-3-large: $0.13 per 1M tokens
            const costPerMillionTokens = 0.13;
            const estimatedCost = (totalTokens / 1_000_000) * costPerMillionTokens;
            console.log("[Embedding] 💰 Embedding cost details:", {
                model: EMBEDDING_MODEL,
                promptTokens,
                totalTokens,
                estimatedCostUSD: `$${estimatedCost.toFixed(6)}`,
                user: userId,
                client: clientId,
                textHash,
            });
        } else {
            console.warn("[Embedding] No usage data returned in embedding response.");
        }
        // --- End cost logging ---

        if (!isFiniteNumberArray(vector)) {
            console.warn("[Embedding] Embedding result invalid/empty.", {
                user: userId,
                client: clientId,
                gotType: Array.isArray(vector) ? "array" : typeof vector,
                vectorLength: Array.isArray(vector) ? vector.length : null,
                textHash,
            });
            return null;
        }

        console.log("[Embedding] Embedding generated successfully.", {
            vectorLength: vector.length,
            textHash,
            user: userId,
            client: clientId,
            truncated,
        });

        return vector;
    } catch (err) {
        const meta = classifyEmbeddingError(err);

        console.error("❌ [Embedding] Embedding generation failed:", {
            errorType: meta.type,
            status: meta.status,
            errorMessage: err?.message,
            stack: err?.stack,
            user: userId,
            client: clientId,
            textHash,
        });

        return null; // fail silently, pipeline continues
    }
}
