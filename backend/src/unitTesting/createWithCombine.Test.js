// createWithCombine.Test.js
// Location: backend/src/tests/interviewScheduleErrorTest/createWithCombine.Test.js
// Run: node createWithCombine.Test.js

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// -------------------- ENV (must be set BEFORE importing service) --------------------
process.env.UNIT_TEST = "true";
process.env.NODE_ENV = "test";

// Dummy values to bypass import-time checks in your codebase
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/dummy";
process.env.DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME || "dummy";

// -------------------- Dynamic import (Windows-safe) --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceFilePath = path.join(
  __dirname,
  "../../services/VirtualInterview/InterviewScheduleService.js"
);

const serviceUrl = pathToFileURL(serviceFilePath).href;
const { default: InterviewScheduleService } = await import(serviceUrl);

// -------------------- Mock utils --------------------
function mockChain(finalValue) {
  // supports: .select().lean().populate().sort().exec()
  return {
    select() { return this; },
    lean() { return this; },
    populate() { return this; },
    sort() { return this; },
    exec: async () => finalValue,
  };
}

function makeReq({ models } = {}) {
  return {
    client: "client1",
    user: { _id: "recruiter1", role: "recruiter" },
    headers: { "x-frontend-origin": "http://localhost:3000" },
    conn: { models },
  };
}

function makeModels({
  atsDoc = { candidate: "cand1", job: "job1" },
  candDoc = { firstName: "A", lastName: "B", email: "a@b.com", countryCode: "+91", phoneNumber: "999" },
  jobDoc = { title: "SDE", company: { name: "Acme" }, primarySkills: ["JS"] },
} = {}) {
  return {
    CandidateATS: { findOne: () => mockChain(atsDoc) },
    Candidate: { findOne: () => mockChain(candDoc) },
    Job: {
      findOne: () => ({
        select() { return this; },
        populate() { return this; },
        lean() { return this; },
        exec: async () => jobDoc,
      }),
    },
  };
}

// -------------------- Tiny runner --------------------
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

// -------------------- Tests (Part A: error handling) --------------------
const service = new InterviewScheduleService();

// stub create() so no DB is used
service.create = async (doc) => ({
  ...doc,
  _id: "sched1",
  startAt: doc.startAt,
  durationMinutes: doc.durationMinutes,
});

await runTest("A1 Missing candidateATS => 400", async () => {
  const req = makeReq({ models: makeModels() });
  const res = await service.createWithCombine(
    { interviewDate: "2026-01-12", startTime: "10:00" },
    req
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 400);
  assert.equal(res.message, "candidateATS is required");
});

await runTest("A2 Missing interviewDate => 400", async () => {
  const req = makeReq({ models: makeModels() });
  const res = await service.createWithCombine(
    { candidateATS: "ats1", startTime: "10:00" },
    req
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 400);
  assert.equal(res.message, "interviewDate is required");
});

await runTest("A3 Missing startTime => 400", async () => {
  const req = makeReq({ models: makeModels() });
  const res = await service.createWithCombine(
    { candidateATS: "ats1", interviewDate: "2026-01-12" },
    req
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 400);
  assert.equal(res.message, "startTime is required");
});

await runTest("A4 CandidateATS not found => 404", async () => {
  const req = makeReq({ models: makeModels({ atsDoc: null }) });
  const res = await service.createWithCombine(
    { candidateATS: "ats1", interviewDate: "2026-01-12", startTime: "10:00" },
    req
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 404);
  assert.equal(res.message, "CandidateATS not found");
});

await runTest("A5 Invalid interviewDate/startTime => 400", async () => {
  const req = makeReq({ models: makeModels() });
  const res = await service.createWithCombine(
    { candidateATS: "ats1", interviewDate: "2026-99-99", startTime: "25:99" },
    req
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 400);
  assert.equal(res.message, "Invalid interviewDate/startTime");
});

await runTest("A6 Candidate not found => 404", async () => {
  const req = makeReq({ models: makeModels({ candDoc: null }) });
  const res = await service.createWithCombine(
    { candidateATS: "ats1", interviewDate: "2026-01-12", startTime: "10:00" },
    req
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 404);
  assert.equal(res.message, "Candidate not found");
});

await runTest("A7 Job not found => 404", async () => {
  const req = makeReq({ models: makeModels({ jobDoc: null }) });
  const res = await service.createWithCombine(
    { candidateATS: "ats1", interviewDate: "2026-01-12", startTime: "10:00" },
    req
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 404);
  assert.equal(res.message, "Job not found");
});

await runTest("A8 Phone mode requires meetingLink => 400", async () => {
  const req = makeReq({ models: makeModels() });
  const res = await service.createWithCombine(
    {
      candidateATS: "ats1",
      interviewMode: "Phone",
      interviewDate: "2026-01-12",
      startTime: "10:00",
      meetingLink: "   ",
    },
    req
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 400);
  assert.equal(res.message, "meetingLink is required for Phone interviews");
});

await runTest("A9 DB create throws => 400 with error message", async () => {
  const req = makeReq({ models: makeModels() });

  service.create = async () => {
    throw new Error("Mongo fail");
  };

  const res = await service.createWithCombine(
    {
      candidateATS: "ats1",
      interviewMode: "Virtual",
      interviewDate: "2026-01-12",
      startTime: "10:00",
    },
    req
  );

  assert.equal(res.ok, false);
  assert.equal(res.code, 400);
  assert.equal(res.message, "Mongo fail");
});

console.log("\n✅ Done: createWithCombine Part A error-handling tests.");