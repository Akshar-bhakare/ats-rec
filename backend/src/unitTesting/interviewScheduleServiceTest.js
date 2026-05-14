/**
 * src/tests/interviewScheduleServiceTest.js
 *
 * Unit-test style script (no framework) for InterviewScheduleService.createWithCombine()
 * Prints a checklist of what was tested.
 */


process.env.UNIT_TEST = 'true'; // ✅ important: skips notify/email async side-effects in service
process.env.NODE_ENV = 'test';

// import InterviewScheduleService from '../services/VirtualInterview/InterviewScheduleService.js';

// ----------------------
// Simple test utilities
// ----------------------
const checks = [];

function check(label, condition) {
  const pass = Boolean(condition);
  checks.push({ label, pass });
  if (!pass) throw new Error(label);
}

function printChecks() {
  console.log('\n📋 What we tested:');
  for (const c of checks) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.label}`);
  }
}

function resetChecks() {
  checks.length = 0;
}

// Fake mongoose chain helper: .findOne().select().lean().exec()
const chain = (result) => ({
  select: () => chain(result),
  populate: () => chain(result),
  sort: () => chain(result),
  lean: () => chain(result),
  exec: async () => result,
});

// Fake req builder
function makeReq() {
  return {
    client: 'test-client',
    user: { _id: 'recruiter1', role: 'recruiter' },
    headers: { 'x-frontend-origin': 'http://localhost:3000' },
    conn: { models: {} },
  };
}

// ----------------------
// TESTS
// ----------------------
async function testCreateVirtualInterview() {
  resetChecks();
  console.log('\n🧪 Test: createWithCombine() – Virtual + AI');

  const service = new InterviewScheduleService();
  const req = makeReq();

  // ---- Mock DB models used in createWithCombine before service.create() ----
  req.conn.models.CandidateATS = {
    findOne: () => chain({ candidate: 'cand1', job: 'job1' }),
  };

  req.conn.models.Candidate = {
    findOne: () =>
      chain({
        _id: 'cand1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        countryCode: '+91',
        phoneNumber: '9999999999',
      }),
  };

  req.conn.models.Job = {
    findOne: () =>
      chain({
        _id: 'job1',
        title: 'Full Stack Developer',
        company: { name: 'TestCorp' },
        primarySkills: ['Node', 'React'],
      }),
  };

  // Even though side-effects are skipped by UNIT_TEST, keep safe mocks anyway
  function FakeUserModel(data) {
    Object.assign(this, data);
    this.save = async () => true;
  }
  FakeUserModel.findOne = () => chain(null);
  FakeUserModel.find = () => chain([]);
  req.conn.models.User = FakeUserModel;

  req.conn.models.Notification = {
    insertMany: async () => true,
    create: async () => true,
  };

  // ---- Avoid DB write: override CRUD create() to just return doc ----
  service.create = async (doc) => doc;

  // ---- Payload ----
  const payload = {
    candidateATS: 'ats1',
    interviewMode: 'Virtual',
    interviewDate: '2026-01-15',
    startTime: '10:00',
    interviewerType: 'AI',
    interviewType: 'HR',
    durationMinutes: 30,
  };

  // ---- Execute ----
  const res = await service.createWithCombine(payload, req);

  // ---- Checks ----
  check('Response ok=true', res?.ok === true);
  check('Item exists in response', !!res?.item);

  check('WebRTC link generated', !!res.item.webrtcLink);
  check('MeetingLink equals WebRTC link (Virtual)', res.item.meetingLink === res.item.webrtcLink);

  check('WebRTC link includes candidateId', String(res.item.webrtcLink).includes('cid=cand1'));
  check('WebRTC link includes jobId', String(res.item.webrtcLink).includes('jid=job1'));
  check('WebRTC link includes interviewerType', String(res.item.webrtcLink).includes('itype=AI'));

  check('WebRTC access token generated for Virtual+AI', !!res.item.webrtcAccessToken);
  check('WebRTC access expiry set for Virtual', res.item.webrtcAccessExpiresAt instanceof Date);

  check(
    'HR script selected (GUIDELINES FOR HR INTERVIEWER)',
    String(res.item.technicalScript || '').includes('GUIDELINES FOR HR INTERVIEWER')
  );

  console.log('✅ PASS: Virtual AI interview created correctly');
  printChecks();
}

// ----------------------
// RUNNER
// ----------------------
async function run() {
  const start = Date.now();
  try {
    console.log('\n==============================');
    console.log(' InterviewScheduleService Tests');
    console.log('==============================');

    await testCreateVirtualInterview();

    console.log(`\n🎉 ALL TESTS PASSED (${Date.now() - start} ms)`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED');
    console.error(err?.stack || err?.message || err);

    // Print whatever was recorded before failure
    if (checks.length) printChecks();

    process.exit(1);
  }
}

run();