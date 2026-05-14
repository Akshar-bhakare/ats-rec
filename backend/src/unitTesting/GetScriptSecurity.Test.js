/**
 // Local test script for getScriptByCandidateAndJob()
// Covers validation, token security, expiry, single-use access,
// safe defaults, and coding-round script filtering (C1–C11).
 *
 * Run:
 *   cd src/tests/interviewScheduleErrorTest
 *   node GetScriptSecurity.Test.js
 */

import assert from "assert";
import dotenv from "dotenv";
dotenv.config();



// ✅ set env BEFORE importing app code (ESM)
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/dummy";
process.env.DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME || "dummy";
process.env.NODE_ENV = "development";
process.env.UNIT_TEST = "false";

// --- dynamic import AFTER env set ---
const { default: InterviewScheduleService } = await import(
  "../../services/VirtualInterview/InterviewScheduleService.js"
);

console.log("Imported default type:", typeof InterviewScheduleService);
const tmp =
  typeof InterviewScheduleService === "function"
    ? new InterviewScheduleService()
    : InterviewScheduleService;

console.log("svc prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(tmp)));
console.log("has getScriptByCandidateAndJob:", typeof tmp.getScriptByCandidateAndJob);

// ---------------- helpers ----------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mockQuery(result, { throwOnExec = null } = {}) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    lean() { return this; },
    exec: async () => {
      if (throwOnExec) throw throwOnExec;
      return result;
    },
  };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

// ---------------- fixtures ----------------
const candidateId = "64b7f1b8f1b8f1b8f1b8f1b8";
const jobId = "64b7f1b8f1b8f1b8f1b8f1b9";

const candidateDoc = {
  _id: candidateId,
  firstName: "Nikita",
  lastName: "Test",
  email: "nikita.test@example.com",
};

const jobDoc = {
  _id: jobId,
  title: "Full Stack Dev",
  internalTitle: "FSD",
  company: { name: "Acme" },
  primarySkills: ["Node.js", "React"],
};

function makeSvc() {
  const svc = new InterviewScheduleService();

  // Keep the default generation predictable
  svc.buildTechnicalScriptTemplate = async () => "DEFAULT_TECH_SCRIPT";

  return svc;
}

// Make req with controllable models + capture queries
function makeReq({
  // schedule controls
  scheduleForToken = null,
  scheduleForNoToken = null,
  scheduleAfterConsume = null,

  // coding controls
  problemDoc = null,
  testCasesDoc = [],
  reqUserRole = "recruiter",

  // capture
  capture = {},
} = {}) {
  const InterviewScheduleModel = {
    findOne: (q) => {
      capture.lastInterviewScheduleFindOne = q;

      // If query includes webrtcAccessToken -> token path
      if (q && Object.prototype.hasOwnProperty.call(q, "webrtcAccessToken")) {
        return mockQuery(scheduleForToken);
      }

      // No-token path
      return mockQuery(scheduleForNoToken);
    },

    findOneAndUpdate: (q, upd) => {
      capture.lastInterviewScheduleFindOneAndUpdate = { q, upd };
      return mockQuery(scheduleAfterConsume);
    },
  };

  // Coding models
  const ProblemModel = {
    findOne: (q) => {
      capture.lastProblemFindOne = q;
      return mockQuery(problemDoc);
    }
  };

  const TestCaseModel = {
    find: (q) => {
      capture.lastTestCaseFind = q;
      return {
        sort() { return this; },
        select() { return this; },
        lean() { return this; },
        exec: async () => testCasesDoc,
      };
    }
  };

  return {
    client: "dummyClient",
    user: { _id: "recruiterId", role: reqUserRole },
    headers: { "x-frontend-origin": "http://localhost:3000" },
    conn: {
      models: {
        InterviewSchedule: InterviewScheduleModel,
        Candidate: { findOne: () => mockQuery(candidateDoc) },
        Job: { findOne: () => mockQuery(jobDoc) },
        Problem: ProblemModel,
        TestCase: TestCaseModel,
      }
    }
  };
}

// Utility asserts
function assert400(res) { assert.strictEqual(res.ok, false); assert.strictEqual(res.code, 400); }
function assert403(res) { assert.strictEqual(res.ok, false); assert.strictEqual(res.code, 403); }
function assert404(res) { assert.strictEqual(res.ok, false); assert.strictEqual(res.code, 404); }
function assert410(res) { assert.strictEqual(res.ok, false); assert.strictEqual(res.code, 410); }
function assert200(res) { assert.strictEqual(res.ok, true); assert.strictEqual(res.code, 200); }

// ---------------- C tests ----------------

// C1: missing candidateId/jobId => 400
await runTest("C1 Missing candidateId/jobId => 400", async () => {
  const svc = makeSvc();
  const req = makeReq();
  const res = await svc.getScriptByCandidateAndJob({ candidateId: "", jobId: "" }, req);
  assert400(res);
});

// C2: invalid ObjectId => 400
await runTest("C2 Invalid candidateId/jobId => 400", async () => {
  const svc = makeSvc();
  const req = makeReq();
  const res = await svc.getScriptByCandidateAndJob({ candidateId: "abc", jobId: "xyz" }, req);
  assert400(res);
});

// C3: token provided but schedule not found => 404
await runTest("C3 Token provided but schedule not found => 404", async () => {
  const svc = makeSvc();
  const capture = {};
  const req = makeReq({ scheduleForToken: null, capture });
  const res = await svc.getScriptByCandidateAndJob(
    { candidateId, jobId, accessToken: "tok123" },
    req
  );
  assert404(res);
  assert.ok(capture.lastInterviewScheduleFindOne?.webrtcAccessToken, "Expected token query used");
});

// C4: token provided, schedule found, but already used => 410
await runTest("C4 Token schedule already used => 410", async () => {
  const svc = makeSvc();
  const usedSchedule = {
    _id: "sch1",
    client: "dummyClient",
    candidate: candidateId,
    job: jobId,
    interviewMode: "Virtual",
    startAt: new Date(Date.now() - 10 * 60 * 1000), // started 10 min ago
    durationMinutes: 45,
    webrtcAccessToken: "tok",
    webrtcAccessUsedAt: new Date(Date.now() - 5 * 60 * 1000),
    isArchived: false,
  };

  const req = makeReq({ scheduleForToken: usedSchedule });
  const res = await svc.getScriptByCandidateAndJob(
    { candidateId, jobId, accessToken: "tok" },
    req
  );
  assert410(res);
});

// C5: token provided, link not active yet (now < startAt) => 403
await runTest("C5 Token link not active yet => 403", async () => {
  const svc = makeSvc();
  const future = new Date(Date.now() + 60 * 60 * 1000); // +1h
  const schedule = {
    _id: "sch2",
    client: "dummyClient",
    candidate: candidateId,
    job: jobId,
    interviewMode: "Virtual",
    startAt: future,
    durationMinutes: 45,
    webrtcAccessToken: "tokF",
    webrtcAccessUsedAt: null,
    isArchived: false,
  };

  const req = makeReq({ scheduleForToken: schedule });
  const res = await svc.getScriptByCandidateAndJob(
    { candidateId, jobId, accessToken: "tokF" },
    req
  );
  assert403(res);
});

// C6: token provided, link expired (now > endAt) => 410
await runTest("C6 Token link expired => 410", async () => {
  const svc = makeSvc();
  const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000); // -2h
  const schedule = {
    _id: "sch3",
    client: "dummyClient",
    candidate: candidateId,
    job: jobId,
    interviewMode: "Virtual",
    startAt: pastStart,
    durationMinutes: 30, // ended long ago
    webrtcAccessToken: "tokX",
    webrtcAccessUsedAt: null,
    isArchived: false,
  };

  const req = makeReq({ scheduleForToken: schedule });
  const res = await svc.getScriptByCandidateAndJob(
    { candidateId, jobId, accessToken: "tokX" },
    req
  );
  assert410(res);
});

// C7: token valid -> should consume token via findOneAndUpdate, return 200 and set usedAt
await runTest("C7 Token valid consumes once => 200 and marks usedAt", async () => {
  const svc = makeSvc();
  const capture = {};

  const start = new Date(Date.now() - 5 * 60 * 1000); // started 5 min ago
  const schedule = {
    _id: "sch4",
    client: "dummyClient",
    candidate: candidateId,
    job: jobId,
    interviewMode: "Virtual",
    startAt: start,
    durationMinutes: 45,
    webrtcAccessToken: "tokOK",
    webrtcAccessUsedAt: null,
    technicalScript: "SCHEDULE_SCRIPT",
    roundType: "Speaking",
    isArchived: false,
  };

  // simulate successful "consume"
  const afterConsume = { ...schedule, webrtcAccessUsedAt: new Date() };

  const req = makeReq({
    scheduleForToken: schedule,
    scheduleAfterConsume: afterConsume,
    capture
  });

  const res = await svc.getScriptByCandidateAndJob(
    { candidateId, jobId, accessToken: "tokOK" },
    req
  );

  assert200(res);
  assert.strictEqual(res.data.technicalScript, "SCHEDULE_SCRIPT");
  assert.ok(capture.lastInterviewScheduleFindOneAndUpdate, "Expected token consume update call");
});

// C8: no token, schedule exists but has webrtcAccessToken => 403 "token required"
await runTest("C8 No token but schedule has token => 403", async () => {
  const svc = makeSvc();
  const schedule = {
    _id: "sch5",
    client: "dummyClient",
    candidate: candidateId,
    job: jobId,
    interviewMode: "Virtual",
    startAt: new Date(Date.now() - 5 * 60 * 1000),
    durationMinutes: 45,
    webrtcAccessToken: "tokREQUIRED",
    isArchived: false,
  };

  const req = makeReq({ scheduleForNoToken: schedule });
  const res = await svc.getScriptByCandidateAndJob({ candidateId, jobId, accessToken: "" }, req);
  assert403(res);
  assert.ok(String(res.message || "").toLowerCase().includes("token"), "Expected token-required message");
});

// C9: no token, schedule exists without token, window ok => 200
await runTest("C9 No token schedule ok => 200", async () => {
  const svc = makeSvc();
  const schedule = {
    _id: "sch6",
    client: "dummyClient",
    candidate: candidateId,
    job: jobId,
    interviewMode: "Virtual",
    startAt: new Date(Date.now() - 10 * 60 * 1000),
    durationMinutes: 45,
    webrtcAccessToken: null,
    webrtcAccessUsedAt: null,
    technicalScript: "NO_TOKEN_SCRIPT",
    interviewerType: "AI",
    difficultyLevel: "Intermediate",
    roundType: "Speaking",
    isArchived: false,
  };

  const req = makeReq({ scheduleForNoToken: schedule });
  const res = await svc.getScriptByCandidateAndJob({ candidateId, jobId }, req);

  assert200(res);
  assert.strictEqual(res.data.technicalScript, "NO_TOKEN_SCRIPT");
  assert.strictEqual(res.data.interviewMode, "Virtual");
});

// C10: no schedule found => returns defaults + generated script (DEFAULT_TECH_SCRIPT)
await runTest("C10 No schedule found => 200 with defaults", async () => {
  const svc = makeSvc();
  const req = makeReq({ scheduleForNoToken: null });

  const res = await svc.getScriptByCandidateAndJob({ candidateId, jobId }, req);

  assert200(res);
  assert.strictEqual(res.data.technicalScript, "DEFAULT_TECH_SCRIPT");
  assert.strictEqual(res.data.roundType, "Speaking");
  assert.strictEqual(res.data.problem, null);
  assert.deepStrictEqual(res.data.testCases, []);
});

// C11: coding round -> candidate should get only sample testcases (isSample=true in query)
await runTest("C11 Coding round candidate filters sample testcases", async () => {
  const svc = makeSvc();
  const capture = {};

  const schedule = {
    _id: "sch7",
    client: "dummyClient",
    candidate: candidateId,
    job: jobId,
    interviewMode: "Virtual",
    startAt: new Date(Date.now() - 10 * 60 * 1000),
    durationMinutes: 45,
    webrtcAccessToken: null,
    webrtcAccessUsedAt: null,
    technicalScript: "CODING_SCRIPT",
    interviewerType: "AI",
    difficultyLevel: "Intermediate",
    roundType: "Coding",
    isArchived: false,
  };

  const problemDoc = {
    _id: "prob1",
    interviewId: schedule._id,
    isActive: true,
    title: "Two Sum",
  };

  const testCasesDoc = [
    { _id: "tc1", isSample: true, order: 1 },
    { _id: "tc2", isSample: true, order: 2 },
  ];

  const req = makeReq({
    scheduleForNoToken: schedule,
    problemDoc,
    testCasesDoc,
    reqUserRole: "candidate",
    capture
  });

  const res = await svc.getScriptByCandidateAndJob({ candidateId, jobId }, req);

  assert200(res);
  assert.strictEqual(res.data.roundType, "Coding");
  assert.ok(res.data.problem && res.data.problem._id, "Expected problem to be returned");
  assert.ok(Array.isArray(res.data.testCases), "Expected testCases array");

  // critical security behavior:
  assert.strictEqual(
    capture.lastTestCaseFind?.isSample,
    true,
    "Expected candidate role to request sample testcases only"
  );
});

console.log("\n✅ Done: getScriptByCandidateAndJob() error/security tests (C1–C11).");