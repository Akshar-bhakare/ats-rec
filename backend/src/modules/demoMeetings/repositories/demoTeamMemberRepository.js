const ACTIVE_MEETING_STATUSES = ['pending_provider', 'scheduled'];

const toPlainObject = (value) => typeof value?.toObject === 'function' ? value.toObject() : value;

export default class DemoTeamMemberRepository {
    constructor(conn) {
        this.conn = conn;
    }

    get TeamMemberModel() {
        return this.conn.models['DemoMeetingTeamMember'];
    }

    get ScheduledMeetingModel() {
        return this.conn.models['DemoScheduledMeeting'];
    }

    async findEligibleMembers({ meetingType, role }) {
        const query = {
            isActive: true,
            supportedMeetingTypes: String(meetingType || '').trim().toLowerCase(),
        };

        if (role) {
            query.role = String(role || '').trim().toLowerCase();
        }

        return this.TeamMemberModel
            .find(query)
            .sort({ priority: 1, email: 1 })
            .lean()
            .exec();
    }

    async getDailyMeetingCounts({ memberEmails, dayStart, dayEnd }) {
        const emails = Array.isArray(memberEmails) ? memberEmails.filter(Boolean) : [];
        if (!emails.length) return new Map();

        const rows = await this.ScheduledMeetingModel.aggregate([
            {
                $match: {
                    assignedMemberEmail: { $in: emails },
                    status: { $in: ACTIVE_MEETING_STATUSES },
                    startTime: {
                        $gte: dayStart,
                        $lt: dayEnd,
                    },
                },
            },
            {
                $group: {
                    _id: '$assignedMemberEmail',
                    count: { $sum: 1 },
                },
            },
        ]);

        return new Map(rows.map((row) => [String(row._id || '').toLowerCase(), Number(row.count || 0)]));
    }

    async updateLastAssignedAt(email, when = new Date()) {
        const updated = await this.TeamMemberModel
            .findOneAndUpdate(
                { email: String(email || '').trim().toLowerCase() },
                { $set: { lastAssignedAt: when } },
                { new: true }
            )
            .exec();

        return toPlainObject(updated);
    }
}
