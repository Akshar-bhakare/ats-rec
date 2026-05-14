// HOW TO RUN:
// node backend/src/unitTesting/aiChatCompletions.Test.js
// node backend/src/unitTesting/aiChatCompletions.Test.js --run-live --api-key sk-... --model gpt-5-nano
// node backend/src/unitTesting/aiChatCompletions.Test.js --run-live (uses OPENAI_API_KEY if present)
// node backend/src/unitTesting/aiChatCompletions.Test.js --skip-live

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

let PASS = 0;
let FAIL = 0;
let SKIP = 0;

function assert(cond, msg = "Assertion failed") {
    if (!cond) throw new Error(msg);
}

async function assertThrows(fn, msgContains) {
    let threw = false;
    try {
        await fn();
    } catch (err) {
        threw = true;
        if (msgContains) {
            const msg = String(err?.message || err);
            if (!msg.includes(msgContains)) {
                throw new Error(`Expected error to include "${msgContains}", got "${msg}"`);
            }
        }
    }
    if (!threw) throw new Error("Expected function to throw");
}

async function test(name, fn) {
    try {
        await fn();
        PASS++;
        console.log(`[PASS] ${name}`);
    } catch (err) {
        FAIL++;
        console.error(`[FAIL] ${name}`);
        console.error("  ", err?.message || err);
    }
}

function skip(name, reason) {
    SKIP++;
    console.log(`[SKIP] ${name} - ${reason}`);
}

function chainLeanExec(result) {
    return {
        lean() {
            return this;
        },
        exec: async () => result,
    };
}

function buildReqWithSetting(cfg) {
    return {
        log: {
            info: () => { },
            warn: () => { },
            error: () => { },
        },
        conn: {
            models: {
                Setting: {
                    findOne: () => chainLeanExec(cfg),
                },
            },
        },
    };
}

async function withTempEnv(temp, fn) {
    const backup = {};
    for (const key of Object.keys(temp)) {
        backup[key] = process.env[key];
        if (temp[key] === null) {
            delete process.env[key];
        } else {
            process.env[key] = temp[key];
        }
    }
    try {
        return await fn();
    } finally {
        for (const key of Object.keys(temp)) {
            if (backup[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = backup[key];
            }
        }
    }
}

const args = process.argv.slice(2);
const argSet = new Set(args);
const getArg = (name) => {
    const i = args.indexOf(name);
    if (i >= 0) return args[i + 1];
    const prefix = `${name}=`;
    const kv = args.find((v) => v.startsWith(prefix));
    return kv ? kv.slice(prefix.length) : null;
};

const runLive = argSet.has("--run-live");
const skipLive = argSet.has("--skip-live");
const liveEnabled = runLive && !skipLive;

const apiKeyArg = getArg("--api-key");
const modelArg = getArg("--model");
const liveApiKey = apiKeyArg || process.env.OPENAI_API_KEY;
const liveModel = modelArg || process.env.OPENAI_MODEL || "gpt-5-nano";

/* --------------------- ENV SETUP BEFORE IMPORT --------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

if (!process.env.MONGODB_URI) {
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/dummy_test_db";
}
if (!process.env.DEFAULT_DB_NAME) {
    process.env.DEFAULT_DB_NAME = "dummy_test_db";
}

// Prevent real MongoDB connections during import time (clientDbUtils connects eagerly).
const originalCreateConnection = mongoose.createConnection.bind(mongoose);
mongoose.createConnection = () => {
    const models = {};
    const conn = {
        models,
        model: (name, schema) => {
            if (!models[name]) models[name] = { schema };
            return models[name];
        },
        asPromise: async () => conn,
        on: () => conn,
        close: async () => { },
    };
    return conn;
};

const {
    loadOpenAIConfigFromDB,
    getOpenAIClient,
    chatCompletionByOpenAI,
} = await import("../utils/aiChatCompletions.js");

/* --------------------- loadOpenAIConfigFromDB --------------------- */
await test("loadOpenAIConfigFromDB: returns DB config when apiKey present", async () => {
    const cfg = { configurationDetails: { apiKey: "sk-test", model: "gpt-test", temperature: 0 } };
    const req = buildReqWithSetting(cfg);
    const res = await loadOpenAIConfigFromDB(req);
    assert(res.apiKey === "sk-test", "expected apiKey from db config");
    assert(res.model === "gpt-test", "expected model from db config");
});

await test("loadOpenAIConfigFromDB: falls back to env when db apiKey missing", async () => {
    const cfg = { configurationDetails: { model: "db-model" } };
    const req = buildReqWithSetting(cfg);
    await withTempEnv(
        { OPENAI_API_KEY: "env-key", OPENAI_MODEL: "env-model", OPENAI_TEMPERATURE: "0.2" },
        async () => {
            const res = await loadOpenAIConfigFromDB(req);
            assert(res.apiKey === "env-key", "expected apiKey from env");
            assert(res.model === "env-model", "expected model from env");
        }
    );
});

await test("loadOpenAIConfigFromDB: throws when no key in db or env", async () => {
    const cfg = { configurationDetails: { model: "db-model" } };
    const req = buildReqWithSetting(cfg);
    await withTempEnv(
        { OPENAI_API_KEY: null, OPENAI_MODEL: null, OPENAI_TEMPERATURE: null },
        async () => {
            await assertThrows(
                () => loadOpenAIConfigFromDB(req),
                "No OpenAI API key found"
            );
        }
    );
});

/* --------------------- getOpenAIClient --------------------- */
await test("getOpenAIClient: throws when apiKey missing", async () => {
    await assertThrows(() => getOpenAIClient(""), "OpenAI API key is missing or invalid");
});

await test("getOpenAIClient: returns client when apiKey provided", async () => {
    const client = await getOpenAIClient("sk-test");
    assert(!!client, "expected client object");
    assert(
        typeof client?.chat?.completions?.create === "function",
        "expected client.chat.completions.create to exist"
    );
});

/* --------------------- chatCompletionByOpenAI --------------------- */
await test("chatCompletionByOpenAI: throws on empty messages", async () => {
    const req = { log: { info: () => { }, warn: () => { }, error: () => { } } };
    await assertThrows(() => chatCompletionByOpenAI([], req, null, { apiKey: "sk-test", model: "gpt-test" }), "`messages` must be a non-empty array");
});

await test("chatCompletionByOpenAI: throws on missing apiKey", async () => {
    const req = { log: { info: () => { }, warn: () => { }, error: () => { } } };
    await assertThrows(
        () => chatCompletionByOpenAI([{ role: "user", content: "hi" }], req, null, { apiKey: "", model: "gpt-test" }),
        "OpenAI API key is missing or invalid"
    );
});

if (!liveEnabled) {
    skip("chatCompletionByOpenAI: handles invalid apiKey (live)", "use --run-live to enable network tests");
    skip("chatCompletionByOpenAI: success (live)", "use --run-live and provide a valid key");
} else {
    await test("chatCompletionByOpenAI: handles invalid apiKey (live)", async () => {
        const req = { log: { info: () => { }, warn: () => { }, error: () => { } } };
        const res = await chatCompletionByOpenAI(
            [{ role: "user", content: "Reply with ok." }],
            req,
            null,
            { apiKey: "sk-invalid", model: liveModel }
        );
        assert(res === undefined, "expected undefined result for invalid key (caught error)");
    });

    if (!liveApiKey) {
        skip("chatCompletionByOpenAI: success (live)", "no OPENAI_API_KEY or --api-key provided");
    } else {
        await test("chatCompletionByOpenAI: success (live)", async () => {
            const req = { log: { info: () => { }, warn: () => { }, error: () => { } } };
            const res = await chatCompletionByOpenAI(
                [{ role: "user", content: "Reply with ok." }],
                req,
                null,
                { apiKey: liveApiKey, model: liveModel }
            );
            const content = res?.choices?.[0]?.message?.content || "";
            assert(content.length > 0, "expected non-empty response content");
        });
    }
}

console.log(`\nDone. Passed: ${PASS}, Failed: ${FAIL}, Skipped: ${SKIP}`);
process.exit(FAIL ? 1 : 0);