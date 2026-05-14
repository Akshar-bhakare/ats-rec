process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/demo_meeting_test';
process.env.DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME || 'demo_meeting_test';

const { default: Fastify } = await import('fastify');
const { default: DemoMeetingController } = await import('../modules/demoMeetings/demoMeetingController.js');
const { default: DemoMeetingService } = await import('../modules/demoMeetings/demoMeetingService.js');
const { default: DemoMeetingTeamMemberSchema } = await import('../models/DemoMeetingTeamMember.js');
const { ErrorCodes } = await import('../modules/demoMeetings/utils/demoMeetingErrors.js');
const { sortMembersByFairness } = await import('../modules/demoMeetings/strategies/leastRecentlyAssignedStrategy.js');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createLeadConn(leadDoc) {
    return {
        models: {
            DemoLeads: {
                findOne: () => ({
                    sort: () => ({
                        lean: () => ({
                            exec: async () => leadDoc,
                        }),
                    }),
                }),
            },
        },
    };
}

class FakeMeetingRepository {
    constructor(existingMeeting = null, successfulClaimEmails = ['member-b@hirexit.ai']) {
        this.existingMeeting = existingMeeting;
        this.savedMeeting = null;
        this.failure = null;
        this.claimAttempts = [];
        this.successfulClaimEmails = new Set(successfulClaimEmails);
        this.lastClaimPayload = null;
    }

    async findByIdempotencyKey() {
        return this.existingMeeting;
    }

    async createSchedulingPlaceholder(payload) {
        this.savedMeeting = {
            _id: 'meeting-1',
            ...payload,
        };
        return { meeting: this.savedMeeting, created: true };
    }

    async claimSlotForMeeting(payload) {
        this.claimAttempts.push(payload.assignedMemberEmail);
        if (this.successfulClaimEmails.has(payload.assignedMemberEmail)) {
            this.lastClaimPayload = payload;
            return {
                ...this.savedMeeting,
                assignedMemberName: payload.assignedMemberName,
                assignedMemberEmail: payload.assignedMemberEmail,
                organizerEmail: payload.organizerEmail,
                attendeeEmails: payload.attendeeEmails,
                status: 'pending_provider',
            };
        }

        return null;
    }

    async markScheduled(payload) {
        this.savedMeeting = {
            ...this.savedMeeting,
            status: 'scheduled',
            graphEventId: payload.graphEventId,
            changeKey: payload.changeKey,
            providerRequestId: payload.providerRequestId,
            joinUrl: payload.joinUrl,
            rawProviderResponse: payload.rawProviderResponse,
            assignedMemberName: this.lastClaimPayload?.assignedMemberName || '',
            assignedMemberEmail: this.lastClaimPayload?.assignedMemberEmail || '',
            organizerEmail: this.lastClaimPayload?.organizerEmail || 'demo@hirexit.ai',
            attendeeEmails: this.lastClaimPayload?.attendeeEmails || this.savedMeeting.attendeeEmails,
            startTime: this.savedMeeting.startTime,
            endTime: this.savedMeeting.endTime,
            provider: 'microsoft_graph',
        };
        return this.savedMeeting;
    }

    async markFailure(payload) {
        this.failure = payload;
        return {
            ...this.savedMeeting,
            status: 'provider_failed',
            providerError: payload,
        };
    }
}

class FakeTeamRepository {
    constructor(members, counts = new Map()) {
        this.members = members;
        this.counts = counts;
        this.updatedEmails = [];
    }

    async findEligibleMembers() {
        return this.members;
    }

    async getDailyMeetingCounts() {
        return this.counts;
    }

    async updateLastAssignedAt(email) {
        this.updatedEmails.push(email);
        return { email };
    }
}

class FakeGraphClient {
    constructor(availableEmails) {
        this.availableEmails = new Set(availableEmails);
        this.scheduleCalls = [];
    }

    async getCalendarCapabilities() {
        return {
            organizerEmail: 'demo@hirexit.ai',
            supportsTeamsMeetings: true,
        };
    }

    async getSchedules({ scheduleEmails }) {
        this.scheduleCalls.push([...scheduleEmails]);
        return {
            providerRequestId: 'req-schedule',
            schedules: new Map(
                scheduleEmails.map((email) => [
                    email,
                    { isAvailable: this.availableEmails.has(email), error: null, scheduleItems: [] },
                ])
            ),
        };
    }

    async createEvent() {
        return {
            providerRequestId: 'req-create',
            event: {
                id: 'graph-event-1',
                changeKey: 'change-key-1',
                webLink: 'https://outlook.office.com/calendar/item/1',
                isOnlineMeeting: true,
                onlineMeetingProvider: 'teamsForBusiness',
                onlineMeeting: {
                    joinUrl: 'https://teams.microsoft.com/l/meetup-join/test',
                },
                attendees: [],
            },
        };
    }
}

function createService({ lead, meetingRepository, teamRepository, graphClient, defaultTimezone = 'UTC' }) {
    return new DemoMeetingService({
        conn: createLeadConn(lead || { _id: 'lead-1', email: 'jane@acme.com', verifyEmailOtpVerified: true, firstName: 'Jane', company: 'Acme' }),
        meetingRepository,
        teamMemberRepository: teamRepository,
        graphCalendarClient: graphClient,
        config: {
            organizerEmail: 'demo@hirexit.ai',
            minDurationMinutes: 15,
            maxDurationMinutes: 120,
            defaultTimezone,
            allowOnlineFallback: true,
        },
    });
}

function createRequestBody(overrides = {}) {
    return {
        candidateName: 'Jane Doe',
        candidateEmail: 'jane@acme.com',
        meetingType: 'product_demo',
        startTime: new Date('2026-03-20T14:00:00.000Z'),
        endTime: new Date('2026-03-20T14:30:00.000Z'),
        timezone: 'UTC',
        role: 'solutions_consultant',
        ...overrides,
    };
}

async function testFairnessSort() {
    const sorted = sortMembersByFairness([
        { email: 'c@hirexit.ai', lastAssignedAt: new Date('2026-03-16T10:00:00.000Z'), dailyMeetingCount: 2, priority: 3 },
        { email: 'a@hirexit.ai', lastAssignedAt: new Date('2026-03-15T10:00:00.000Z'), dailyMeetingCount: 3, priority: 3 },
        { email: 'b@hirexit.ai', lastAssignedAt: new Date('2026-03-15T10:00:00.000Z'), dailyMeetingCount: 1, priority: 4 },
    ]);

    assert(sorted[0].email === 'b@hirexit.ai', 'least recently assigned strategy should prefer lower daily count on tie');
}

async function testBypassFairnessIndexExists() {
    const indexes = DemoMeetingTeamMemberSchema.indexes();
    const bypassIndex = indexes.find(([keys]) => keys?.byPassFairness === 1);

    assert(Boolean(bypassIndex), 'team member schema should define an index for byPassFairness');
    assert(bypassIndex[1]?.unique === true, 'byPassFairness index should be unique');
    assert(bypassIndex[1]?.partialFilterExpression?.byPassFairness === true, 'byPassFairness index should be partial for true values');
}

async function testSuccessfulSchedulingWithRaceRetry() {
    const meetingRepository = new FakeMeetingRepository(null, ['member-b@hirexit.ai']);
    const teamRepository = new FakeTeamRepository([
        {
            name: 'Member A',
            email: 'member-a@hirexit.ai',
            role: 'solutions_consultant',
            priority: 1,
            lastAssignedAt: new Date('2026-03-15T10:00:00.000Z'),
            maxMeetingsPerDay: 3,
        },
        {
            name: 'Member B',
            email: 'member-b@hirexit.ai',
            role: 'solutions_consultant',
            priority: 2,
            lastAssignedAt: new Date('2026-03-15T10:00:00.000Z'),
            maxMeetingsPerDay: 3,
        },
    ], new Map([
        ['member-a@hirexit.ai', 1],
        ['member-b@hirexit.ai', 2],
    ]));

    const service = createService({
        meetingRepository,
        teamRepository,
        graphClient: new FakeGraphClient(['member-a@hirexit.ai', 'member-b@hirexit.ai']),
        defaultTimezone: 'America/New_York',
    });

    const result = await service.scheduleMeeting({
        body: createRequestBody({ timezone: 'America/New_York' }),
        headers: { 'x-idempotency-key': 'idem-12345678' },
    });

    assert(result.httpStatus === 201, 'successful schedule should return HTTP 201');
    assert(result.body.success === true, 'successful schedule should set success=true');
    assert(result.body.assignedMember.email === 'member-b@hirexit.ai', 'service should retry after slot race and pick next fair member');
    assert(meetingRepository.claimAttempts.join(',') === 'member-a@hirexit.ai,member-b@hirexit.ai', 'service should attempt the next candidate when the first slot claim fails');
    assert(teamRepository.updatedEmails[0] === 'member-b@hirexit.ai', 'lastAssignedAt should update only for the selected member');
}

async function testBypassHostSelectedBeforeFairnessAndBypassesDailyCap() {
    const meetingRepository = new FakeMeetingRepository(null, ['host-1@hirexit.ai']);
    const teamRepository = new FakeTeamRepository([
        {
            name: 'Host 1',
            email: 'host-1@hirexit.ai',
            role: 'solutions_consultant',
            priority: 1,
            lastAssignedAt: new Date('2026-03-20T12:00:00.000Z'),
            maxMeetingsPerDay: 1,
            byPassFairness: true,
        },
        {
            name: 'Host 2',
            email: 'host-2@hirexit.ai',
            role: 'solutions_consultant',
            priority: 2,
            lastAssignedAt: new Date('2026-03-19T08:00:00.000Z'),
            maxMeetingsPerDay: 3,
        },
    ], new Map([
        ['host-1@hirexit.ai', 5],
        ['host-2@hirexit.ai', 0],
    ]));

    const graphClient = new FakeGraphClient(['host-1@hirexit.ai', 'host-2@hirexit.ai']);
    const service = createService({
        meetingRepository,
        teamRepository,
        graphClient,
    });

    const result = await service.scheduleMeeting({
        body: createRequestBody(),
        headers: { 'x-idempotency-key': 'idem-bypass-picked' },
    });

    assert(result.body.assignedMember.email === 'host-1@hirexit.ai', 'bypass host should be selected before fairness flow');
    assert(meetingRepository.claimAttempts.join(',') === 'host-1@hirexit.ai', 'bypass host should be claimed before trying standard hosts');
    assert(graphClient.scheduleCalls.length === 1, 'only bypass availability should be checked when bypass host is selected');
    assert(graphClient.scheduleCalls[0].join(',') === 'host-1@hirexit.ai', 'bypass availability check should target only the bypass host');
    assert(teamRepository.updatedEmails[0] === 'host-1@hirexit.ai', 'lastAssignedAt should update for the bypass-selected host');
}

async function testBypassHostBusyFallsBackToNormalFairness() {
    const meetingRepository = new FakeMeetingRepository(null, ['host-3@hirexit.ai']);
    const teamRepository = new FakeTeamRepository([
        {
            name: 'Host 1',
            email: 'host-1@hirexit.ai',
            role: 'solutions_consultant',
            priority: 1,
            lastAssignedAt: new Date('2026-03-20T12:00:00.000Z'),
            maxMeetingsPerDay: 1,
            byPassFairness: true,
        },
        {
            name: 'Host 2',
            email: 'host-2@hirexit.ai',
            role: 'solutions_consultant',
            priority: 2,
            lastAssignedAt: new Date('2026-03-18T08:00:00.000Z'),
            maxMeetingsPerDay: 4,
        },
        {
            name: 'Host 3',
            email: 'host-3@hirexit.ai',
            role: 'solutions_consultant',
            priority: 3,
            lastAssignedAt: new Date('2026-03-18T08:00:00.000Z'),
            maxMeetingsPerDay: 4,
        },
    ], new Map([
        ['host-2@hirexit.ai', 2],
        ['host-3@hirexit.ai', 1],
    ]));

    const graphClient = new FakeGraphClient(['host-2@hirexit.ai', 'host-3@hirexit.ai']);
    const service = createService({
        meetingRepository,
        teamRepository,
        graphClient,
    });

    const result = await service.scheduleMeeting({
        body: createRequestBody(),
        headers: { 'x-idempotency-key': 'idem-bypass-fallback' },
    });

    assert(result.body.assignedMember.email === 'host-3@hirexit.ai', 'busy bypass host should fall back to the normal fairness flow');
    assert(meetingRepository.claimAttempts.join(',') === 'host-3@hirexit.ai', 'fallback fairness flow should only claim standard hosts');
    assert(graphClient.scheduleCalls.length === 2, 'service should perform a bypass check and then a standard-host check');
    assert(graphClient.scheduleCalls[0].join(',') === 'host-1@hirexit.ai', 'first availability call should target the bypass host');
    assert(graphClient.scheduleCalls[1].join(',') === 'host-2@hirexit.ai,host-3@hirexit.ai', 'second availability call should target only the standard hosts');
}

async function testIdempotencyReplay() {
    const service = new DemoMeetingService({
        conn: createLeadConn({ _id: 'lead-1', email: 'jane@acme.com', verifyEmailOtpVerified: true }),
        meetingRepository: {
            findByIdempotencyKey: async () => ({
                _id: 'meeting-replay',
                status: 'scheduled',
                assignedMemberName: 'Asha',
                assignedMemberEmail: 'asha@hirexit.ai',
                organizerEmail: 'demo@hirexit.ai',
                startTime: new Date('2026-03-20T14:00:00.000Z'),
                endTime: new Date('2026-03-20T14:30:00.000Z'),
                joinUrl: 'https://teams.microsoft.com/replay',
                provider: 'microsoft_graph',
            }),
        },
        teamMemberRepository: new FakeTeamRepository([]),
        graphCalendarClient: new FakeGraphClient([]),
        config: {
            organizerEmail: 'demo@hirexit.ai',
            minDurationMinutes: 15,
            maxDurationMinutes: 120,
            defaultTimezone: 'UTC',
            allowOnlineFallback: true,
        },
    });

    const result = await service.scheduleMeeting({
        body: createRequestBody(),
        headers: { 'x-idempotency-key': 'idem-replay-123' },
    });

    assert(result.httpStatus === 200, 'scheduled replay should return HTTP 200');
    assert(result.body.isReplay === true, 'scheduled replay should be marked as replay');
}

async function testNoEligibleMembersFailure() {
    const meetingRepository = new FakeMeetingRepository();
    const service = createService({
        meetingRepository,
        teamRepository: new FakeTeamRepository([]),
        graphClient: new FakeGraphClient([]),
    });

    let failed = null;
    try {
        await service.scheduleMeeting({
            body: createRequestBody(),
            headers: { 'x-idempotency-key': 'idem-no-eligible' },
        });
    } catch (error) {
        failed = error;
    }

    assert(failed?.code === ErrorCodes.NO_ELIGIBLE_MEMBERS, 'no eligible members should throw the expected error code');
    assert(meetingRepository.failure?.code === ErrorCodes.NO_ELIGIBLE_MEMBERS, 'failure should be persisted for idempotency visibility');
}

async function testControllerValidation() {
    const app = Fastify({ logger: false });
    const controller = new DemoMeetingController({
        service: {
            scheduleMeeting: async () => ({
                httpStatus: 201,
                body: { success: true },
            }),
        },
    });

    app.post('/api/demo-meetings/schedule', async (req, reply) => controller.schedule(req, reply));
    await app.ready();

    const response = await app.inject({
        method: 'POST',
        url: '/api/demo-meetings/schedule',
        payload: {
            candidateName: 'Jane Doe',
            candidateEmail: 'jane@acme.com',
            meetingType: 'product_demo',
            startTime: '2026-03-20T14:00:00.000Z',
            endTime: '2026-03-20T14:30:00.000Z',
            timezone: 'UTC',
        },
    });

    await app.close();

    assert(response.statusCode === 400, 'missing idempotency header should fail validation');
}

async function run() {
    const tests = [
        ['Fairness strategy sort', testFairnessSort],
        ['Bypass fairness index exists', testBypassFairnessIndexExists],
        ['Successful scheduling with slot-race retry', testSuccessfulSchedulingWithRaceRetry],
        ['Bypass host is selected before fairness and ignores daily cap', testBypassHostSelectedBeforeFairnessAndBypassesDailyCap],
        ['Busy bypass host falls back to fairness flow', testBypassHostBusyFallsBackToNormalFairness],
        ['Idempotency replay returns stored meeting', testIdempotencyReplay],
        ['No eligible members failure path', testNoEligibleMembersFailure],
        ['Controller validation for idempotency header', testControllerValidation],
    ];

    let passCount = 0;

    for (const [name, testFn] of tests) {
        try {
            await testFn();
            passCount += 1;
            console.log(`PASS ${name}`);
        } catch (error) {
            console.error(`FAIL ${name}`);
            console.error(error?.stack || error?.message || error);
            process.exit(1);
        }
    }

    console.log(`All demo meeting tests passed (${passCount}/${tests.length})`);
    process.exit(0);
}

run();
