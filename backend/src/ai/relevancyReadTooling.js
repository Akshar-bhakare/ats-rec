import { tool } from '@openai/agents';
import { z } from 'zod';
import RelevancyService from '../services/relevancyService.js';

const svc = new RelevancyService();
const getReq = (ctx) => (ctx?.req ?? ctx?.context?.req ?? null);

export const listRelevancyRecords = tool({
    name: 'list_relevancy_records',
    description:
        'List RelevancyRecord rows for the current client, including candidate/job refs plus scores such as candidateRelevancyToJob, jobRelevancyToCandidate, experienceRelevancy, skillsRelevancy, responsibilitiesRelevancy, designationRelevancy, communicationRelevancy, salaryRelevancy, noticePeriodRelevancy, interestRelevancy, reason, isArchived, and eventIds.' +
        "You can use this tool to get candidate analysis against job, when you search any candidate via job.",
    parameters: z.object({
        candidateId: z.string().nullable(),
        jobId: z.string().nullable(),
        isArchived: z.boolean().nullable().default(false),
        limit: z.number().int().positive().nullable(),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const isArchived = args?.isArchived ?? false;
        const payload = {
            ...(args?.candidateId ? { candidateId: args.candidateId } : {}),
            ...(args?.jobId ? { jobId: args.jobId } : {}),
            ...(args?.limit ? { limit: args.limit } : {}),
            isArchived,
        };

        const res = await svc.listRelevancy(payload, req.user, req.client, req.conn);
        return JSON.stringify(res);
    },
});

export const getRelevancyRecord = tool({
    name: 'get_relevancy_record',
    description: 'Get a single RelevancyRecord returns the directional scores, sub-dimension relevancies, reason text, archive flag, and optional populated events.',
    parameters: z.object({
        id: z.string(),
        includeEvents: z.boolean().nullable().default(false),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const includeEvents = args?.includeEvents ?? false;
        const payload = {
            id: args.id,
            ...(includeEvents ? { getEvents: true } : {}),
        };

        const res = await svc.getRelevancyDetails(payload, req.user, req.client, req.conn);
        return JSON.stringify(res);
    },
});
