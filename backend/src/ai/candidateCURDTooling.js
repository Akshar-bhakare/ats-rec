// backend\src\ai\candidateCURDTooling.js
import { tool } from '@openai/agents';
import { z } from 'zod';
import CandidateService from '../services/candidateService.js';
import { chatCompletionByOpenAI } from '../utils/aiChatCompletions.js';
import mongoose from 'mongoose';

const svc = new CandidateService();
const getReq = (ctx) => (ctx?.req ?? ctx?.context?.req ?? null);
const getWs = (ctx) => (ctx?.ws ?? ctx?.context?.ws ?? null);

const compactNonBlanks = (obj = {}) => {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => {
        if (Array.isArray(v)) {
            if (v.length) out[k] = v;
        } else if (v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')) {
            out[k] = v;
        }
    });
    return out;
};

export const createCandidateFromFrontend = tool({
    name: 'create_candidate_from_frontend',
    description:
        "Open the New Candidates flow and prefill from uploaded resume(s). "
        + "If resumes are not provided as parameters, this tool will read files uploaded "
        + "via the chat '+' button from ctx.context.clsObj.dataFromFrontend.resumes. "
        + "It will parse details and set `candidateInitialValuesDict`, then open /candidates/new/.",
    parameters: z.object({
        // jobId: z.string().nullable(),
        prefill: z.object({}).catchall(z.string()).nullable(),
        resumesB64: z.array(
            z.object({
                filename: z.string(),
                base64: z.string(),
                mimetype: z.string().nullable(),
                size: z.number().int().nonnegative().nullable(),
            })
        ).nullable(),
    }).strict(),
    async execute(args, ctx) {
        const ws = getWs(ctx);
        const req = ctx?.req ?? ctx?.context?.req;

        // 1) prefer explicit param, else pull from ws "dataFromFrontend"
        let resumes = Array.isArray(args?.resumesB64) ? args.resumesB64 : null;
        if (!resumes?.length) resumes = ctx?.context?.clsObj?.dataFromFrontend?.resumes || [];

        let candidateInitialValuesDict = args?.prefill || null;

        // 2) parse resumes through existing service (local extract first, then ILovePDF)
        if (Array.isArray(resumes) && resumes.length) {
            const toServiceShape = resumes.map((f, i) => ({
                filename: f?.filename || `resume-${i}.pdf`,
                _buf: Buffer.from(f?.base64 || '', 'base64'),
            }));

            const svcLocal = new (await import('../services/candidateService.js')).default();
            const fakeReq = { ...req, body: { resumes: toServiceShape } };
            try {
                const parsed = await svcLocal.uploadCandidateCVs(fakeReq);
                candidateInitialValuesDict = { ...(candidateInitialValuesDict || {}), ...(parsed || {}) };
            } catch (err) {
                console.log('[createCandidateFromFrontend] parse failed:', err?.message);
            }
        }

        if (args?.jobId) {
            candidateInitialValuesDict = { ...(candidateInitialValuesDict || {}), jobId: args.jobId };
        }

        if (ws?.send) {
            ws.send(JSON.stringify({
                event: 'frontendActionChangeCandidateGState',
                setGState: { candidateInitialValuesDict: candidateInitialValuesDict || {} },
            }));
            return JSON.stringify({
                ok: true,
                code: 200,
                message: "Prefilled Candidate(s) from resume(s); opening /candidates/new/.",
            });
        }

        return JSON.stringify({ ok: false, code: 400, message: 'Websocket not available' });
    },
});

export const submitCandidateCreationForm = tool({
    name: 'submit_candidate_creation_form',
    description: "Programmatically submit the New Candidates form (same as clicking 'Validate & Save').",
    parameters: z.object({}).strict(),
    async execute(_args, ctx) {
        const ws = getWs(ctx);
        if (ws?.send) {
            ws.send(JSON.stringify({ event: 'frontendActionSubmitCandidateCreationForm' }));
            return JSON.stringify({ ok: true, code: 200, message: 'Submitted candidate form.' });
        }
        return JSON.stringify({ ok: false, code: 400, message: 'Websocket not available' });
    },
});

export const updateCandidateFromFrontend = tool({
    name: 'update_candidate_from_frontend',
    description:
        "This tool sets a new candidate details in the frontend form. " +
        "Pass only changed fields + candidateId." +
        "Frontend fetches the full candidate, merges your changes, displays frontend form to user for review",
    parameters: z.object({
        candidateId: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        email: z.string().nullable(),
        countryCode: z.string().nullable(),
        phoneNumber: z.string().nullable(),
        skills: z.union([z.string(), z.array(z.string())]).nullable(),
        experience: z.union([z.string(), z.number()]).nullable(),
        resumeUrl: z.string().nullable(),
        panCardNumber: z.string().nullable(),
        isArchived: z.boolean().nullable(),
        // add any other editable fields you support on EditCandidate
    }),
    async execute(args, ctx) {
        const ws = getWs(ctx);
        if (!ws?.send) return JSON.stringify({ ok: false, code: 400, message: 'Websocket connection not found…' });

        const { candidateId, ...rest } = args || {};
        console.log(
            "[update_candidate_from_frontend] args: ", args,
        );

        if (!candidateId) return JSON.stringify({ ok: false, code: 400, message: 'candidateId is required' });
        if (!mongoose.Types.ObjectId.isValid(candidateId)) return JSON.stringify({ ok: false, code: 400, message: 'candidateId is invalid', details: { candidateId } });

        const changed = compactNonBlanks(rest);

        ws.send(JSON.stringify({
            event: 'frontendActionChangeCandidateUpdateGState',
            setGState: { candidateId, changed },
        }));
        return JSON.stringify({ ok: true, code: 200, message: 'Opened the edit form with your changes prefilled. Please ask to review to user, if user confirms then submit/save/update candidate form...', });
    },
});

/* --------------------- (optional) SUBMIT UPDATE (frontend) ------------------ */
export const submitCandidateUpdateForm = tool({
    name: 'submit_candidate_update_form',
    description: "This tool saves the Candidate edit form(frontend). Use only after the user confirms the changes he/she asked are correct and wants save the form.",
    parameters: z.object({ id: z.string() }).strict(),
    async execute(args, ctx) {
        console.log(
            "submit_candidate_update_form tool invoked..."
        );

        const ws = getWs(ctx);
        if (!ws?.send) return JSON.stringify({ ok: false, code: 400, message: 'Websocket connection not found…' });
        ws.send(JSON.stringify({ event: 'frontendActionSubmitCandidateUpdateForm', id: args.id }));
        return JSON.stringify({ ok: true, code: 200, message: 'Candidate update form submitted.' });
    },
});

/* ----------------------------------- GET ----------------------------------- */
export const getCandidate = tool({
    name: 'get_candidate',
    description: 'Get a single candidate by id (optionally include events).',
    parameters: z.object({
        id: z.string(),
        includeEvents: z.boolean().nullable().default(false),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        console.log('[get_candidate] start', { userId: req?.user?._id, clientId: req?.client?._id, id: args?.id, includeEvents: !!args?.includeEvents });
        console.time('[get_candidate] svc.getCandidateDetails');
        const res = await svc.getCandidateDetails(
            { id: args.id, ...(args.includeEvents ? { getEvents: true } : {}) },
            req.user,
            req.client,
            req.conn
        );
        console.timeEnd('[get_candidate] svc.getCandidateDetails');
        console.log('[get_candidate] done', { found: res?.item ? 1 : 0 });
        return JSON.stringify(res);
    },
});

/* ---------------------------------- LIST ----------------------------------- */
export const listCandidates = tool({
    name: 'list_candidates',
    description: "List candidates for the current client. Supports IDs, partial fields, viewMode ('me'|'byUser'|'all'), limit, archived flag.",
    parameters: z.object({
        ids: z.union([z.string(), z.array(z.string())]).nullable(),
        fields: z.string().nullable(),
        viewMode: z.enum(['me', 'byUser', 'all']).nullable(),
        userId: z.string().nullable(),
        limit: z.number().int().positive().nullable(),
        isArchived: z.boolean().nullable().default(false),
        includeEvents: z.boolean().nullable().default(false),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const isArchived = args?.isArchived ?? false;
        const includeEvents = args?.includeEvents ?? false;
        console.log('[list_candidates] start', {
            userId: req?.user?._id,
            clientId: req?.client?._id,
            hasIds: !!args?.ids,
            hasFields: !!args?.fields,
            viewMode: args?.viewMode ?? null,
            forUserId: args?.userId ?? null,
            limit: args?.limit ?? null,
            isArchived,
            includeEvents,
        });
        const payload = {
            ...(args.ids ? { ids: args.ids } : {}),
            ...(args.fields ? { fields: args.fields } : {}),
            ...(args.viewMode ? { viewMode: args.viewMode } : {}),
            ...(args.userId ? { userId: args.userId } : {}),
            ...(args.limit ? { limit: args.limit } : {}),
            isArchived,
            ...(includeEvents ? { getEvents: true } : {}),
        };
        console.time('[list_candidates] svc.getCandidates');
        const res = await svc.getCandidates(payload, req.user, req.client, req.conn);
        console.timeEnd('[list_candidates] svc.getCandidates');
        console.log('[list_candidates] done', { count: Array.isArray(res?.items) ? res.items.length : 0 });
        return JSON.stringify(res);
    },
});

/* --------------------------------- SEARCH ---------------------------------- */
export const searchCandidates = tool({
    name: 'search_candidates',
    description:
        "Search candidates by free text across first name, last name, email, phone, uploadedBy, skills and 'uploadedBy'. Uses list endpoint then filters server-side.",
    parameters: z.object({
        query: z.string().min(1, 'query is required'),
        viewMode: z.enum(['me', 'byUser', 'all']).nullable(),
        userId: z.string().nullable(),
        isArchived: z.boolean().nullable().default(false),
        limit: z.number().int().positive().nullable(),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const isArchived = args?.isArchived ?? false;
        console.log('[search_candidates] start', {
            userId: req?.user?._id,
            clientId: req?.client?._id,
            query: args?.query,
            viewMode: args?.viewMode ?? null,
            forUserId: args?.userId ?? null,
            isArchived,
            limit: args?.limit ?? null,
        });

        console.time('[search_candidates] svc.getCandidates');
        const START_LIMIT = Math.max(args.limit || 0, 10); // sane starting window
        const base = await svc.getCandidates(
            {
                ...(args.viewMode ? { viewMode: args.viewMode } : {}),
                ...(args.userId ? { userId: args.userId } : {}),
                isArchived,
                getEvents: true,                   // ensure uploadedBy tokens available
                ...(START_LIMIT ? { limit: START_LIMIT } : {}),
            },
            req.user,
            req.client,
            req.conn
        );
        console.timeEnd('[search_candidates] svc.getCandidates');

        // ---------------- helpers ----------------
        const norm = (s) =>
            String(s ?? '')
                .toLowerCase()
                .replace(/[^a-z0-9+@.]+/g, ' ') // keep + @ . to help phone/email
                .trim();

        const tokenize = (s) => norm(s).split(/\s+/).filter(Boolean);

        const skillsTokensFrom = (skills) => {
            if (!Array.isArray(skills)) {
                if (typeof skills === 'string') {
                    return skills
                        .split(/[\/,;|]/g)
                        .map((x) => x.trim())
                        .filter(Boolean)
                        .flatMap(tokenize);
                }
                return [];
            }
            const labels = [];
            for (const s of skills) {
                if (!s) continue;
                if (typeof s === 'string') labels.push(s);
                else if (typeof s === 'object') {
                    if (s.name && typeof s.name === 'string') labels.push(s.name);
                    const keys = Object.keys(s);
                    if (keys.length === 1 && typeof keys[0] === 'string') labels.push(keys[0]);
                }
            }
            const exploded = labels
                .flatMap((n) => n.split(/[\/,;|]/g))
                .map((x) => x.trim())
                .filter(Boolean);

            const out = new Set();
            for (const label of exploded) for (const t of tokenize(label)) out.add(t);
            return Array.from(out);
        };

        const fieldsToTokenSet = (c) => {
            const uploadedBy =
                c?.uploadedBy && typeof c.uploadedBy === 'object'
                    ? c.uploadedBy.name || c.uploadedBy.fullName || c.uploadedBy.email || c.uploadedBy._id || ''
                    : c?.uploadedBy || '';

            const text = [
                c.firstName,
                c.lastName,
                c.fullName,
                c.middleName,
                c.email,
                c.phoneNumber,
                uploadedBy,
                Array.isArray(c.tags) ? c.tags.join(' ') : '',
                c.notes || '',
            ]
                .filter(Boolean)
                .map(norm)
                .join(' ');

            const set = new Set(text.split(' ').filter(Boolean));
            for (const t of skillsTokensFrom(c.skills)) set.add(t);
            return set;
        };

        // --------- dynamic skill inference + scoring ----------

        // IMPORTANT: previously this used chatCompletionByOpenAI to expand the query into
        // additional inferred skills/keywords. That call could accumulate large context
        // and trigger `context_length_exceeded` from the OpenAI Responses API.
        //
        // To keep this tool stable and avoid hard failures, we now skip that AI call and
        // rely purely on the user's query tokens.
        //
        // If you re-enable it later, make absolutely sure you bound the prompt size and do
        // NOT feed large histories / payloads into the model.

        let inferred = [];
        // try {
        //     const prompt = `
        // Return ONLY a compact JSON array of canonical skills/keywords for resume search based on this role text.
        // No prose. No code fences.
        // Input: "${String(args.query || '').trim()}"`.trim();
        //
        //     const ai = await chatCompletionByOpenAI([{ role: 'system', content: prompt }], req);
        //     let content = ai?.choices?.[0]?.message?.content?.trim() || '[]';
        //     if (content.startsWith('```')) {
        //         content = content.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
        //     }
        //     const parsed = JSON.parse(content);
        //     if (Array.isArray(parsed)) inferred = parsed.map(String);
        // } catch (_) {
        //     // if the LLM trips, we just proceed with user tokens
        // }

        const baseQTokens = tokenize(args.query);
        const qTokens = Array.from(new Set([...baseQTokens, ...inferred.flatMap(tokenize)])).filter(Boolean);

        const scoreAndFilter = (arr) => {
            const out = [];
            for (const c of arr || []) {
                const bag = fieldsToTokenSet(c);
                let score = 0;
                for (const qt of qTokens) if (bag.has(qt)) score++;
                if (score > 0) out.push({ c, score });
            }
            out.sort((a, b) => b.score - a.score);
            return out.map((o) => o.c);
        };

        // First pass results (ranked)
        let items = scoreAndFilter(base?.items);
        let baseCount = Array.isArray(base?.items) ? base.items.length : 0;
        console.log('[search_candidates] filtered', { baseCount, resultCount: items.length });

        // ----- incremental expansion: widen limit, accumulate, final re-rank -----
        {
            const HARD_CAP = 10000; // safety ceiling
            const foundById = new Set((items || []).map((c) => String(c._id || c.id)));
            let prevCount = baseCount;
            let limit = START_LIMIT || baseCount || 10;

            while (limit && limit < HARD_CAP) {
                const nextLimit = Math.min(limit * 2 || limit + 10, HARD_CAP);
                if (nextLimit === limit) break;
                limit = nextLimit;

                console.log('[search_candidates] fallback: refetch with larger limit', { tryLimit: limit });
                console.time('[search_candidates] svc.getCandidates(fallback)');
                const nextBase = await svc.getCandidates(
                    {
                        ...(args.viewMode ? { viewMode: args.viewMode } : {}),
                        ...(args.userId ? { userId: args.userId } : {}),
                        isArchived,
                        getEvents: true,
                        limit,
                    },
                    req.user,
                    req.client,
                    req.conn
                );
                console.timeEnd('[search_candidates] svc.getCandidates(fallback)');

                const nextCount = Array.isArray(nextBase?.items) ? nextBase.items.length : 0;
                const nextMatches = scoreAndFilter(nextBase?.items);
                for (const c of nextMatches) {
                    const id = String(c._id || c.id);
                    if (!foundById.has(id)) {
                        foundById.add(id);
                        items.push(c);
                    }
                }
                if (nextCount <= prevCount || nextCount < limit) break; // source pool stopped growing
                prevCount = nextCount;
            }

            // final re-rank
            items = scoreAndFilter(items);
        }

        return JSON.stringify({ ok: true, code: 200, items });
    },
});

/* -------------------------------- ARCHIVE ---------------------------------- */
export const archiveCandidate = tool({
    name: 'archive_candidate',
    description: 'Soft-delete (archive) a candidate by id.',
    parameters: z.object({ id: z.string() }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        console.log('[archive_candidate] start', { userId: req?.user?._id, clientId: req?.client?._id, id: args?.id });
        console.time('[archive_candidate] svc.archiveCandidate');
        const res = await svc.archiveCandidate({ id: args.id }, req.user, req.client, req.conn);
        console.timeEnd('[archive_candidate] svc.archiveCandidate');
        console.log('[archive_candidate] done', { code: res?.code ?? res?.status ?? 200 });
        return JSON.stringify(res);
    },
});

/* ------------------------------- UNARCHIVE --------------------------------- */
export const unarchiveCandidate = tool({
    name: 'unarchive_candidate',
    description: 'Unarchive a candidate by id.',
    parameters: z.object({ id: z.string() }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        console.log('[unarchive_candidate] start', { userId: req?.user?._id, clientId: req?.client?._id, id: args?.id });
        console.time('[unarchive_candidate] svc.unarchiveCandidate');
        const res = await svc.unarchiveCandidate({ id: args.id }, req.user, req.client, req.conn);
        console.timeEnd('[unarchive_candidate] svc.unarchiveCandidate');
        console.log('[unarchive_candidate] done', { code: res?.code ?? res?.status ?? 200 });
        return JSON.stringify(res);
    },

});

/* --------------------- RESUME UPDATE FROM CHAT ------------------ */
export const updateCandidateResumeFromFrontend = tool({
    name: 'update_candidate_resume_from_frontend',
    description:
        "Directly update a candidate's resume using an uploaded file, without opening any form. " +
        "If resumes are not provided as parameters, this tool will read files uploaded via the chat '+' button " +
        "from ctx.context.clsObj.dataFromFrontend.resumes. It uploads to storage and updates Candidate.resumeUrl.",
    parameters: z.object({
        candidateId: z.string(),
        resumesB64: z.array(
            z.object({
                filename: z.string(),
                base64: z.string(),
                mimetype: z.string().nullable(),
                size: z.number().int().nonnegative().nullable(),
            })
        ).nullable(),
    }).strict(),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const ws = getWs(ctx);
        const candidateId = args?.candidateId;

        if (!candidateId) {
            return JSON.stringify({ ok: false, code: 400, message: 'candidateId is required' });
        }

        // Prefer explicit param, else use staged uploads from the chat
        let resumes = Array.isArray(args?.resumesB64) ? args.resumesB64 : null;
        if (!resumes?.length) resumes = ctx?.context?.clsObj?.dataFromFrontend?.resumes || [];

        if (!Array.isArray(resumes) || resumes.length === 0) {
            return JSON.stringify({ ok: false, code: 400, message: 'No resume file found to update. Please attach a resume.' });
        }

        // Re-shape to service expected [{ filename, _buf }]
        const toServiceShape = resumes.map((f, i) => ({
            filename: f?.filename || `resume-${i}.pdf`,
            _buf: Buffer.from(f?.base64 || '', 'base64'),
        }));

        const fakeReq = { ...req, body: { resumes: toServiceShape } };

        try {
            const res = await svc.updateCandidateFromMultipart(candidateId, fakeReq);
            if (!res?.ok) {
                return JSON.stringify({ ok: false, code: res?.code || 400, message: res?.message || 'Failed to update resume', details: res?.details });
            }

            const updated = res?.details?.updated || null;

            if (ws?.send) {
                ws.send(JSON.stringify({
                    event: 'message',
                    message: `Resume updated for candidate ${candidateId}${updated?.resumeUrl ? `.\nNew URL: ${updated.resumeUrl}` : ''}`,
                }));
            }

            return JSON.stringify({
                ok: true,
                code: 200,
                message: 'Resume updated successfully',
                details: { updated },
            });
        } catch (err) {
            console.log('[updateCandidateResumeFromFrontend] error:', err?.message);
            return JSON.stringify({ ok: false, code: 500, message: 'Server error while updating resume' });
        }
    },
});

/* ---------------------------------------------------------
   TOOL: vector_search_candidates
   Reuses CandidateService.runVectorCandidateSearch()
------------------------------------------------------------ */
export const vectorSearchCandidates = tool({
    name: "vector_search_candidates",
    description: "Find top matching candidates using vector DB semantic search. Accepts a free-text query and returns ranked candidates.",
    parameters: z.object({
        query: z.string().min(1, "query is required"),
        limit: z.number().int().positive().nullable().default(10)
    }),
    async execute(args, ctx) {
        const req = ctx?.req ?? ctx?.context?.req;
        const ws = ctx?.ws ?? ctx?.context?.ws;

        console.log("\n=============== [TOOL][VECTOR] EXEC START ===============");
        console.log("[TOOL][VECTOR] Input args:", args);

        try {
            const query = args.query;
            const limit = args?.limit ?? 10;

            console.log("[TOOL][VECTOR] Calling service.runVectorCandidateSearch...");

            // Reuse service instance from ctx
            const svc = new (await import("../services/candidateService.js")).default();

            const result = await svc.runVectorCandidateSearch(query, req, limit);

            if (!result?.ok) {
                console.log("[TOOL][VECTOR][ERROR] Service returned error:", result?.error);
                return JSON.stringify({
                    ok: false,
                    error: result?.error,
                    stage: result?.stage
                });
            }

            console.log("[TOOL][VECTOR] ✔ Results:", result.items?.length || 0);
            console.log("=============== [TOOL][VECTOR] EXEC END ===============\n");

            return JSON.stringify({
                ok: true,
                items: result.items,
                meta: result.meta
            });

        } catch (err) {
            console.error("[TOOL][VECTOR][FATAL ERROR]:", err);
            return JSON.stringify({
                ok: false,
                error: err?.message || "Unknown error",
                stage: "tool_fatal"
            });
        }
    }
});

