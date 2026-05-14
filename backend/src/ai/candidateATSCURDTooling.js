// backend/src/ai/candidateATSCURDTooling.js
import { tool } from '@openai/agents';
import { z } from 'zod';
import CandidateATSService from '../services/candidateATSService.js';

const svc = new CandidateATSService();

const getReq = (ctx) => (ctx?.req ?? ctx?.context?.req ?? null);

/* ------------------------------ LIST (ATS View) ------------------------------ */
/**
 * Mirrors GET /candidate-ats/ -> CandidateATSService.getATSListView
 * No params required; service ignores payload and uses req context.
 */
export const listCandidateATS = tool({
    name: 'list_candidate_ats',
    description: 'List ATS view data for candidates (applications, stages, jobs, company). Matches the REST list output.',
    // keeping parameters empty to reflect your current service usage
    parameters: z.object({}),
    async execute(_args, ctx) {
        const req = getReq(ctx);
        console.log('[list_candidate_ats] start', { userId: req?.user?._id, clientId: req?.client?._id });

        console.time('[list_candidate_ats] svc.getATSListView');
        const res = await svc.getATSListView({}, req.user, req.client, req.conn);
        console.timeEnd('[list_candidate_ats] svc.getATSListView');

        console.log('[list_candidate_ats] done', {
            ok: !!res?.ok,
            count: Array.isArray(res?.items) ? res.items.length : 0,
            code: res?.code || 200
        });
        return JSON.stringify(res);
    },
});

/* -------------------------------- READ (ATS) -------------------------------- */
/**
 * Mirrors GET /candidate-ats/:id with optional stageResults population.
 */
export const getCandidateATS = tool({
    name: 'get_candidate_ats',
    description: 'Get a single Candidate ATS record by id. Optionally include populated stageResults.',
    parameters: z.object({
        id: z.string(),
        includeStageResults: z.boolean().nullable().default(false),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const includeStageResults = args?.includeStageResults ?? false;
        console.log('[get_candidate_ats] start', {
            userId: req?.user?._id,
            clientId: req?.client?._id,
            id: args?.id,
            includeStageResults,
        });

        console.time('[get_candidate_ats] svc.getATSDetails');
        const res = await svc.getATSDetails(
            { id: args.id, includeStageResults },
            req.user,
            req.client,
            req.conn
        );
        console.timeEnd('[get_candidate_ats] svc.getATSDetails');

        console.log('[get_candidate_ats] done', { ok: !!res?.ok, code: res?.code || 200 });
        return JSON.stringify(res);
    },
});

/* ----------------------- UPDATE StageResult inside ATS ----------------------- */
/**
 * Mirrors PUT /candidate-ats/:atsId/stageresult/:srId
 */
export const updateCandidateATSStageResult = tool({
    name: 'update_candidate_ats_stage_result',
    description: 'Update a single StageResult inside a Candidate ATS chain.',
    parameters: z.object({
        atsId: z.string(),
        srId: z.string(),
        stageStatus: z.string().nullable().default(''),
        remarkOrFeedback: z.string().nullable().default(''),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const stageStatus = args?.stageStatus ?? '';
        const remarkOrFeedback = args?.remarkOrFeedback ?? '';
        console.log('[update_candidate_ats_stage_result] start', {
            userId: req?.user?._id,
            clientId: req?.client?._id,
            atsId: args?.atsId,
            srId: args?.srId,
            hasStatus: typeof stageStatus === 'string' && stageStatus.length > 0,
            hasRemark: typeof remarkOrFeedback === 'string' && remarkOrFeedback.length > 0,
        });

        console.time('[update_candidate_ats_stage_result] svc.updateStageResult');
        const res = await svc.updateStageResult(
            {
                atsId: args.atsId,
                srId: args.srId,
                stageStatus,
                remarkOrFeedback,
            },
            req
        );
        console.timeEnd('[update_candidate_ats_stage_result] svc.updateStageResult');

        console.log('[update_candidate_ats_stage_result] done', { ok: !!res?.ok, code: res?.code || 200 });
        return JSON.stringify(res);
    },
});
