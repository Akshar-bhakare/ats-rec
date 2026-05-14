
import assert from "assert";
import dotenv from "dotenv";
dotenv.config();

process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/dummy";
process.env.DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME || "dummy";

process.env.NODE_ENV = "development";
process.env.UNIT_TEST = "false";

// Track unhandled promise rejections from the side-effects async IIFE
const unhandled = [];
process.on("unhandledRejection", (reason) => {
  unhandled.push(reason);
});

// --- import AFTER env is set (ESM) ---
// --- import AFTER env is set (ESM) ---
const { default: InterviewScheduleService } = await import(
  "../../services/VirtualInterview/InterviewScheduleService.js"
);



// ---------- helpers ----------
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

// ---------- shared fixtures ----------
const candidateId = "64b7f1b8f1b8f1b8f1b8f1b8";
const jobId = "64b7f1b8f1b8f1b8f1b8f1b9";
const candidateATSId = "64b7f1b8f1b8f1b8f1b8f1c0";
const recruiterId = "64b7f1b8f1b8f1b8f1b8f1aa";

const candDoc = {
  _id: candidateId,
  firstName: "Nikita",
  lastName: "Test",
  // set email null when you want to SKIP candidate email side-effect paths
  email: "nikita.test@example.com",
  countryCode: "+91",
  phoneNumber: "9999999999",
};

const jobDoc = {
  _id: jobId,
  title: "Full Stack Dev",
  internalTitle: "FSD",
  company: { name: "Acme" },
  primarySkills: ["Node.js", "React"],
};

const atsDoc = { candidate: candidateId, job: jobId };

const basePayload = {
  candidateATS: candidateATSId,
  interviewMode: "Virtual",
  interviewDate: "2026-01-13",
  startTime: "10:30",
  durationMinutes: 45,
  interviewers: ["64b7f1b8f1b8f1b8f1b8f1d1"],
  interviewerType: "AI",
  interviewType: "Technical",
  difficultyLevel: "Intermediate",
};

// Make a req with controllable side-effect failure points + counters
function makeReq({
  // side-effect failure toggles
  notifInsertManyThrows = false,
  notifCreateThrows = false,
  userSaveThrows = false,

  // to avoid calling interviewer email (can't mock), set interviewer email empty
  interviewerEmail = "",

  // to avoid candidate email sending path, set candidate email null/empty
  candidateEmail = "nikita.test@example.com",
} = {}) {
  const counters = {
    notifInsertMany: 0,
    notifCreate: 0,
    userFindOne: 0,
    userSave: 0,
    userFind: 0,
  };

  function UserModelCtor(doc) {
    Object.assign(this, doc);
    this.save = async () => {
      counters.userSave += 1;
      if (userSaveThrows) throw new Error("Simulated candidate user save failure");
      return { ok: true };
    };
  }

  // existing user lookup (for candidate login creation)
  UserModelCtor.findOne = () => {
    counters.userFindOne += 1;
    return mockQuery(null); // pretend user doesn't exist so it tries to create
  };

  // interviewer docs lookup
  UserModelCtor.find = () => {
    counters.userFind += 1;
    return mockQuery([
      {
        _id: "64b7f1b8f1b8f1b8f1b8f1d1",
        firstName: "Inter",
        lastName: "Viewer",
        email: interviewerEmail || "",
      },
    ]);
  };

  const NotificationModel = {
    insertMany: async () => {
      counters.notifInsertMany += 1;
      if (notifInsertManyThrows) throw new Error("Simulated Notification.insertMany failure");
      return { ok: true };
    },
    create: async () => {
      counters.notifCreate += 1;
      if (notifCreateThrows) throw new Error("Simulated Notification.create failure");
      return { ok: true };
    },
  };

  const req = {
    client: "dummyClient",
    user: { _id: recruiterId, role: "recruiter" },
    headers: { "x-frontend-origin": "http://localhost:3000" },
    conn: {
      models: {
        CandidateATS: { findOne: () => mockQuery(atsDoc) },
        Candidate: {
          findOne: () => mockQuery({ ...candDoc, email: candidateEmail }),
        },
        Job: { findOne: () => mockQuery(jobDoc) },
        User: UserModelCtor,
        Notification: NotificationModel,
      },
    },
  };

  return { req, counters };
}

// Create service with DB create monkeypatched
function makeSvc() {
  const svc = new InterviewScheduleService();
  svc.create = async (doc) => ({
    ...doc,
    _id: "64b7f1b8f1b8f1b8f1b8f199",
    startAt: doc.startAt,
    durationMinutes: doc.durationMinutes,
    interviewMode: doc.interviewMode,
    meetingLink: doc.meetingLink,
    notes: doc.notes,
  });
  return svc;
}

// Utility: assert 201 response
function assert201(res) {
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.code, 201);
  assert.ok(res.item && res.item._id);
}

// ---------- B12 → B16 tests ----------

// B12: Notification.insertMany throws → API must still return 201 and no unhandled rejection
await runTest("B12 Notification.insertMany failure must NOT fail API", async () => {
  unhandled.length = 0;

  const { req, counters } = makeReq({
    notifInsertManyThrows: true,
    // Keep candidateEmail null to avoid email path; keep interviewerEmail empty
    candidateEmail: null,
    interviewerEmail: "",
  });

  const svc = makeSvc();
  const res = await svc.createWithCombine(basePayload, req);
  assert201(res);

  // allow side-effects IIFE to run
  await sleep(100);

  assert.ok(counters.notifInsertMany >= 1, "Expected Notification.insertMany to be called");
  assert.strictEqual(unhandled.length, 0, `Unhandled: ${unhandled.map(e => e?.message || String(e)).join(" | ")}`);
});

// B13: Candidate user save fails → API must still return 201 and no unhandled rejection
await runTest("B13 Candidate user creation (User.save) failure must NOT fail API", async () => {
  unhandled.length = 0;

  const { req, counters } = makeReq({
    userSaveThrows: true,
    candidateEmail: "nikita.test@example.com", // ensures it tries user creation
    interviewerEmail: "", // skip interviewer emails
  });

  const svc = makeSvc();
  const res = await svc.createWithCombine(basePayload, req);
  assert201(res);

  await sleep(100);

  assert.ok(counters.userSave >= 1, "Expected candidate User.save attempt");
  assert.strictEqual(unhandled.length, 0, `Unhandled: ${unhandled.map(e => e?.message || String(e)).join(" | ")}`);
});

// B14: Notification.create throws in "missing interviewer email" branch → should NOT create unhandled rejection
// IMPORTANT: Your current code does NOT wrap Notification.create in try/catch in some places.
// If this test FAILS, it means you should wrap those Notification.create calls in try/catch.
await runTest("B14 Notification.create failure in side-effects must NOT produce unhandledRejection", async () => {
  unhandled.length = 0;

  const { req, counters } = makeReq({
    notifCreateThrows: true,
    candidateEmail: null,   // skip candidate email path
    interviewerEmail: "",   // triggers 'No email for interviewer' -> Notification.create
  });

  const svc = makeSvc();
  const res = await svc.createWithCombine(basePayload, req);
  assert201(res);

  await sleep(150);

  // This SHOULD be true (it attempted to create a notification)
  assert.ok(counters.notifCreate >= 1, "Expected Notification.create to be called");

  // If this fails: wrap Notification.create calls inside try/catch in the side-effects IIFE
  assert.strictEqual(
    unhandled.length,
    0,
    `Unhandled side-effect rejection happened (wrap Notification.create in try/catch): ${
      unhandled.map(e => e?.message || String(e)).join(" | ")
    }`
  );
});

// B15: Even if BOTH insertMany + user save fail together → API must still return 201 and no unhandled rejection
await runTest("B15 Multiple side-effect failures together must NOT fail API", async () => {
  unhandled.length = 0;

  const { req, counters } = makeReq({
    notifInsertManyThrows: true,
    userSaveThrows: true,
    candidateEmail: "nikita.test@example.com",
    interviewerEmail: "",
  });

  const svc = makeSvc();
  const res = await svc.createWithCombine(basePayload, req);
  assert201(res);

  await sleep(150);

  assert.ok(counters.notifInsertMany >= 1, "Expected Notification.insertMany to be called");
  assert.ok(counters.userSave >= 1, "Expected User.save to be attempted");
  assert.strictEqual(unhandled.length, 0, `Unhandled: ${unhandled.map(e => e?.message || String(e)).join(" | ")}`);
});

// B16: When UNIT_TEST=true (or NODE_ENV=test), side-effects are skipped completely
await runTest("B16 UNIT_TEST=true should skip side-effects completely", async () => {
  unhandled.length = 0;

  // flip env for this test
  process.env.UNIT_TEST = "true";
  process.env.NODE_ENV = "test";

  const { req, counters } = makeReq({
    notifInsertManyThrows: true,
    notifCreateThrows: true,
    userSaveThrows: true,
    candidateEmail: "nikita.test@example.com",
    interviewerEmail: "",
  });

  const svc = makeSvc();
  const res = await svc.createWithCombine(basePayload, req);
  assert201(res);

  await sleep(150);

  // Because skipSideEffects is ON, these should not run
  assert.strictEqual(counters.notifInsertMany, 0, "insertMany should be skipped in test mode");
  assert.strictEqual(counters.notifCreate, 0, "create should be skipped in test mode");
  assert.strictEqual(counters.userSave, 0, "User.save should be skipped in test mode");
  assert.strictEqual(unhandled.length, 0, `Unhandled: ${unhandled.map(e => e?.message || String(e)).join(" | ")}`);

  // restore env
  process.env.UNIT_TEST = "false";
  process.env.NODE_ENV = "development";
});

console.log("\n✅ Done: createWithCombine Part B side-effects tests (B12–B16).");