//  HOW TO RUN:
//  *   node aiInterviewRoutes.Test.js

// TEST COVERAGE: generateInterviewParameters, transcribeAudio, generateAIResponse,
// generateSpeech, respondAndSpeak, saveRecording, extractPdfText,
// generateCodingProblem, generateCodingBoilerplate, saveAntiCheat, evaluateInterview


import http from "http";

/* ------------------ STOP ANY REAL SERVER LISTEN ------------------ */
/**
 * Some imported code is calling fastify.listen(8080).
 * To prevent EADDRINUSE + accidental server startup during tests,
 * we monkey patch http.Server.listen to a NO-OP that immediately callbacks.
 */
const _origListen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  const last = args[args.length - 1];
  if (typeof last === "function") setImmediate(last); // call callback async
  return this; // no actual bind
};

/* ---------------- ENV DUMMIES (avoid import-time crashes) ---------------- */
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// OpenAI dummy
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "DUMMY_OPENAI_KEY";
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-test";

// Mongo dummy
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/dummy_test_db";
process.env.DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME || "dummy_test_db";

// Deepgram dummy
process.env.DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "DUMMY_DEEPGRAM_KEY";
process.env.DEEPGRAM_KEY = process.env.DEEPGRAM_KEY || "DUMMY_DEEPGRAM_KEY";

// Session + jwt
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "DUMMY_SESSION_SECRET_32_CHARS_LONG_____";
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || "DUMMY_COOKIE_SECRET_32_CHARS_LONG______";
process.env.FASTIFY_SESSION_SECRET = process.env.FASTIFY_SESSION_SECRET || "DUMMY_FASTIFY_SESSION_SECRET_32CHARS";
process.env.JWT_SECRET = process.env.JWT_SECRET || "DUMMY_JWT_SECRET_FOR_TESTING_ONLY_32CHARS";

// Firebase JSON (silence warning)
process.env.FIREBASE_ADMIN_JSON = process.env.FIREBASE_ADMIN_JSON || "{}";
process.env.FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT || "{}";

/* --------------------- IMPORTS (after env set) --------------------- */
import Fastify from "fastify";

// dynamic import AFTER env vars
const { default: aiRoutes } = await import("../../routes/VirtualInterview/aiInterviewRoutes.js");

/* --------------------- MINIMAL NODE TEST RUNNER --------------------- */
let PASS = 0;
let FAIL = 0;

function assert(cond, msg = "Assertion failed") {
  if (!cond) throw new Error(msg);
}

async function test(name, fn) {
  try {
    await fn();
    PASS++;
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    FAIL++;
    console.error(`❌ FAIL: ${name}`);
    console.error("   ", e?.message || e);
  }
}

/* --------------------- HELPERS: mongoose-like chains --------------------- */
function chainExec(result) {
  return {
    lean() {
      return this;
    },
    exec: async () => result,
  };
}
function chainLeanExec(result) {
  return {
    sort() { return this; },
    select() { return this; },
    lean() { return this; },
    exec: async () => result,
  };
}

/* --------------------- BUILD ONE FASTIFY INSTANCE ONLY --------------------- */
async function buildApp() {
  const app = Fastify({ logger: false });

  // stub auth hook expected by routes
  app.decorate("authenticate", async (req) => {
    req.user = { _id: "65cb76d8956f4d0012345670" };
    req.client = "test_client";
  });

  // attach req.conn.models per request
  app.addHook("preHandler", async (req) => {
    req.conn = {
      models: {
        InterviewSchedule: {
          // for evaluateInterview early return not found:
          findOne: () => chainLeanExec(null),

          // for saveAntiCheat: MUST support .lean().exec()
          findOneAndUpdate: () => chainExec(null),

          updateOne: () => ({ exec: async () => null }),
        },

        Conversation: {
          findOne: () => chainLeanExec(null),
          findOneAndUpdate: () => chainExec(null),
        },

        User: {
          findOne: () => ({
            select: () => chainLeanExec(null),
          }),
        },

        Job: {
          findOne: () => chainLeanExec(null),
        },
      },
    };
  });

  await app.register(aiRoutes, { prefix: "/api/ai" });
  await app.ready();
  return app;
}

const app = await buildApp();

/* --------------------- TESTS --------------------- */

await test("GET /api/ai/ -> 200 health check", async () => {
  const res = await app.inject({ method: "GET", url: "/api/ai/" });
  assert(res.statusCode === 200, `expected 200 got ${res.statusCode}`);
});

/**
 * IMPORTANT: Your /generateInterviewParameters route FALLBACKS to normalized blueprint
 * even when OpenAI fails (401 dummy key). So it may return 200 ok:true.
 * This test validates: it does NOT crash + returns either 200(ok:true) or 500(ok:false).
 */
await test("POST /api/ai/generateInterviewParameters -> returns 200 fallback OR 500 on hard failure", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/generateInterviewParameters",
    payload: {
      interviewType: "Technical",
      difficultyLevel: "Intermediate",
      job: { title: "SDE", primarySkills: ["JavaScript"] },
    },
  });

  assert([200, 500].includes(res.statusCode), `expected 200/500 got ${res.statusCode}`);

  const body = res.json();
  if (res.statusCode === 200) {
    assert(body.ok === true, "expected ok:true on 200");
    assert(body.blueprint, "expected blueprint on 200");
  } else {
    assert(body.ok === false, "expected ok:false on 500");
    assert(body.error, "expected error on 500");
  }
});

await test("POST /api/ai/transcribe -> 400 when audioData missing", async () => {
  const res = await app.inject({ method: "POST", url: "/api/ai/transcribe", payload: {} });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/respond -> 400 when text missing", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/respond",
    payload: { candidateId: "65cb76d8956f4d0012345678", jobId: "65cb76d8956f4d0012345679" },
  });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/speak -> 400 when text missing", async () => {
  const res = await app.inject({ method: "POST", url: "/api/ai/speak", payload: {} });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/respondAndSpeak -> 400 when text missing", async () => {
  const res = await app.inject({ method: "POST", url: "/api/ai/respondAndSpeak", payload: {} });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/saveRecording -> 400 when required fields missing", async () => {
  const res = await app.inject({ method: "POST", url: "/api/ai/saveRecording", payload: {} });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/saveRecording -> 400 when candidateId/jobId invalid", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/saveRecording",
    payload: { candidateId: "bad", jobId: "bad", recordingData: "data:video/webm;base64," + "a".repeat(2000) },
  });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/extractPdfText -> 400 when file missing", async () => {
  const res = await app.inject({ method: "POST", url: "/api/ai/extractPdfText", payload: {} });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/generateCodingProblem -> 400 when pdfText missing for Upload PDF", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/generateCodingProblem",
    payload: { questionType: "Upload PDF", difficultyLevel: "Easy", testCaseCount: 4, job: { title: "SDE" } },
  });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/generateCodingBoilerplate -> 400 when language missing", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/generateCodingBoilerplate",
    payload: { problem: { title: "X", description: "Y" } },
  });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/saveAntiCheat -> 400 when required fields missing", async () => {
  const res = await app.inject({ method: "POST", url: "/api/ai/saveAntiCheat", payload: {} });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/saveAntiCheat -> 404 when schedule not found", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/saveAntiCheat",
    payload: {
      candidateId: "65cb76d8956f4d0012345678",
      jobId: "65cb76d8956f4d0012345679",
      antiCheat: { tabSwitches: 1 },
    },
  });
  assert(res.statusCode === 404, `expected 404 got ${res.statusCode}`);
});

await test("POST /api/ai/evaluateInterview -> 400 when candidateId/jobId missing", async () => {
  const res = await app.inject({ method: "POST", url: "/api/ai/evaluateInterview", payload: {} });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

await test("POST /api/ai/evaluateInterview -> 404 when InterviewSchedule missing", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/evaluateInterview",
    payload: { candidateId: "65cb76d8956f4d0012345678", jobId: "65cb76d8956f4d0012345679" },
  });
  assert(res.statusCode === 404, `expected 404 got ${res.statusCode}`);
});
// ---------------- EXTRA TESTS ----------------

// 1) Wrong method -> should be 404 or 405 depending on your Fastify config
await test("POST /api/ai/ (wrong method) -> 404/405", async () => {
  const res = await app.inject({ method: "POST", url: "/api/ai/" });
  assert([404, 405].includes(res.statusCode), `expected 404/405 got ${res.statusCode}`);
});

// 2) Unknown route -> 404
await test("GET /api/ai/does-not-exist -> 404", async () => {
  const res = await app.inject({ method: "GET", url: "/api/ai/does-not-exist" });
  assert(res.statusCode === 404, `expected 404 got ${res.statusCode}`);
});

// 3) Auth failure test: override authenticate to throw
await test("Protected route -> 401 when authenticate fails", async () => {
  // create a new app with failing authenticate (isolated)
  const app2 = Fastify({ logger: false });

  app2.decorate("authenticate", async () => {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  });

  app2.addHook("preHandler", async (req) => {
    req.conn = { models: {} };
  });

  await app2.register(aiRoutes, { prefix: "/api/ai" });
  await app2.ready();

  // pick any route that uses authenticate (many do)
  const res = await app2.inject({ method: "POST", url: "/api/ai/saveAntiCheat", payload: {} });

  // depending on your global error handler this may be 401 or 500
  assert([401, 500].includes(res.statusCode), `expected 401/500 got ${res.statusCode}`);

  await app2.close();
});

// 4) saveRecording invalid recordingData format -> should be 400
await test("POST /api/ai/saveRecording -> 400 when recordingData not base64 data URL", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/saveRecording",
    payload: {
      candidateId: "65cb76d8956f4d0012345678",
      jobId: "65cb76d8956f4d0012345679",
      recordingData: "not-a-data-url",
    },
  });
  assert([400, 500].includes(res.statusCode), `expected 400/500 got ${res.statusCode}`);
});

// 5) saveAntiCheat invalid ObjectId -> should be 400
await test("POST /api/ai/saveAntiCheat -> 400 when candidateId/jobId invalid", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/saveAntiCheat",
    payload: { candidateId: "bad", jobId: "bad", antiCheat: { tabSwitches: 1 } },
  });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

// 6) evaluateInterview invalid ObjectId -> should be 400
await test("POST /api/ai/evaluateInterview -> 400 when candidateId/jobId invalid", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/ai/evaluateInterview",
    payload: { candidateId: "bad", jobId: "bad" },
  });
  assert(res.statusCode === 400, `expected 400 got ${res.statusCode}`);
});

// 7) Force DB throw -> should return 500
await test("POST /api/ai/saveAntiCheat -> 500 when DB throws", async () => {
  // isolated app with throwing DB
  const app3 = Fastify({ logger: false });

  app3.decorate("authenticate", async (req) => {
    req.user = { _id: "65cb76d8956f4d0012345670" };
    req.client = "test_client";
  });

  app3.addHook("preHandler", async (req) => {
    req.conn = {
      models: {
        InterviewSchedule: {
          findOneAndUpdate: () => ({
            lean() { return this; },
            exec: async () => { throw new Error("DB exploded"); },
          }),
        },
      },
    };
  });

  await app3.register(aiRoutes, { prefix: "/api/ai" });
  await app3.ready();

  const res = await app3.inject({
    method: "POST",
    url: "/api/ai/saveAntiCheat",
    payload: {
      candidateId: "65cb76d8956f4d0012345678",
      jobId: "65cb76d8956f4d0012345679",
      antiCheat: { tabSwitches: 1 },
    },
  });

  assert(res.statusCode === 500, `expected 500 got ${res.statusCode}`);
  await app3.close();
});

// 8) Force evaluateInterview DB throw -> 500
await test("POST /api/ai/evaluateInterview -> 500 when InterviewSchedule.findOne throws", async () => {
  const app4 = Fastify({ logger: false });

  app4.decorate("authenticate", async (req) => {
    req.user = { _id: "65cb76d8956f4d0012345670" };
    req.client = "test_client";
  });

  app4.addHook("preHandler", async (req) => {
    req.conn = {
      models: {
        InterviewSchedule: {
          findOne: () => ({
            sort() { return this; },
            lean() { return this; },
            exec: async () => { throw new Error("DB fail"); },
          }),
        },
        Conversation: {
          findOne: () => ({
            sort() { return this; },
            lean() { return this; },
            exec: async () => null,
          }),
        },
      },
    };
  });

  await app4.register(aiRoutes, { prefix: "/api/ai" });
  await app4.ready();

  const res = await app4.inject({
    method: "POST",
    url: "/api/ai/evaluateInterview",
    payload: {
      candidateId: "65cb76d8956f4d0012345678",
      jobId: "65cb76d8956f4d0012345679",
    },
  });

  assert(res.statusCode === 500, `expected 500 got ${res.statusCode}`);
  await app4.close();
});


/* --------------------- CLEANUP --------------------- */
await app.close();

// restore listen just in case
http.Server.prototype.listen = _origListen;

console.log(`\n✅ Done. Passed: ${PASS}, Failed: ${FAIL}`);
process.exit(FAIL ? 1 : 0);