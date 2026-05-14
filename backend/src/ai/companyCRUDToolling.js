import { tool } from '@openai/agents';
import { z } from 'zod';
import CompanyService from '../services/companyService.js';

const svc = new CompanyService();

const getReq = (ctx) => (ctx?.req ?? ctx?.context?.req ?? null);
const getWs = (ctx) => (ctx?.ws ?? ctx?.context?.ws ?? null);

// strip null/undefined/blank strings/empty arrays
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

/* ---------------- CREATE (hydrate form and open) ---------------- */
export const createCompanyFromFrontend = tool({
    name: 'create_company_from_frontend',
    description:
        "Prefill the New Company form (global `companyInitialValuesDict`) and open /companies/new/. " +
        "Pass any subset of fields; they'll prefill on the form.",
    parameters: z.object({
        name: z.string().nullable(),
        about: z.string().nullable(),
        industry: z.string().nullable(),
        size: z.string().nullable(),
        description: z.string().nullable(),
        website: z.string().nullable(),
        logoUrl: z.string().nullable(),
        policyBenefits: z.string().nullable(),
        faqs: z.array(z.string()).nullable(),
    }),
    async execute(args, ctx) {
        const ws = getWs(ctx);
        const clean = compactNonBlanks(args || {});
        if (!ws?.send) return JSON.stringify({ ok: false, code: 400, message: 'Websocket connection not found…' });

        ws.send(JSON.stringify({
            event: 'frontendActionChangeCompanyGState',
            setGState: { companyInitialValuesDict: clean },
        }));
        return JSON.stringify({ ok: true, code: 200, message: 'Company form hydrated. Opening /companies/new/…' });
    },
});

/* ---------------- UPDATE (Job-style) ---------------- */
export const updateCompanyFromFrontend = tool({
    name: 'update_company_from_frontend',
    description:
        "Company tool — update (frontend): Pass `{ companyId, <changedFieldsOnly> }`. The UI fetches, merges deltas, opens /companies/new/, and the user submits. " +
        "Prefer this over any direct update; it prevents null-pollution and respects required-field validation.",
    parameters: z.object({
        companyId: z.string(),
        name: z.string().nullable(),
        about: z.string().nullable(),
        industry: z.string().nullable(),
        size: z.string().nullable(),
        description: z.string().nullable(),
        website: z.string().nullable(),
        logoUrl: z.string().nullable(),
        policyBenefits: z.string().nullable(),
        faqs: z.array(z.string()).nullable(),
        isArchived: z.boolean().nullable(),
    }),
    async execute(args, ctx) {
        const ws = getWs(ctx);
        if (!ws?.send) return JSON.stringify({ ok: false, code: 400, message: 'Websocket connection not found…' });
        const { companyId, ...rest } = args || {};
        if (!companyId) return JSON.stringify({ ok: false, code: 400, message: 'companyId is required' });

        const changed = compactNonBlanks(rest);
        ws.send(JSON.stringify({
            event: 'frontendActionChangeCompanyUpdateGState',
            setGState: { companyId, changed },
        }));
        return JSON.stringify({ ok: true, code: 200, message: 'Frontend will fetch + merge changes, then open /companies/new/.' });
    },
});


/* ---------------- SUBMIT (frontend triggers POST/PUT) ---------------- */
export const submitCompanyCreationForm = tool({
    name: 'submit_company_creation_form',
    description: "Programmatically submit the Company form (create or update).",
    parameters: z.object({}),
    async execute(_args, ctx) {
        const ws = getWs(ctx);
        if (!ws?.send) return JSON.stringify({ ok: false, code: 400, message: 'Websocket connection not found…' });
        ws.send(JSON.stringify({ event: 'frontendActionSubmitCompanyCreationForm' }));
        return JSON.stringify({ ok: true, code: 200, message: 'Company form submitted.' });
    },
});

/* ---------------- READ/LIST/SEARCH/ARCHIVE (unchanged) ---------------- */
export const getCompany = tool({
    name: 'get_company',
    description: 'Get a single company by id.',
    parameters: z.object({ id: z.string() }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const res = await svc.getCompanyDetails({ id: args.id }, req.user, req.client, req.conn);
        return JSON.stringify(res);
    },
});

export const listCompanies = tool({
    name: 'list_companies',
    description: 'List companies for the current client. Supports ids and archived flag.',
    parameters: z.object({
        ids: z.union([z.string(), z.array(z.string())]).nullable(),
        isArchived: z.boolean().nullable().default(false),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const isArchived = args?.isArchived ?? false;
        const payload = { ...(args?.ids ? { ids: args.ids } : {}), isArchived };
        const res = await svc.getCompanies(payload, req.user, req.client, req.conn);
        return JSON.stringify(res);
    },
});

export const searchCompanies = tool({
    name: 'search_companies',
    description: 'Search companies by free text across metadata and FAQs.',
    parameters: z.object({
        query: z.string().min(1, 'query is required'),
        isArchived: z.boolean().nullable().default(false),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const isArchived = args?.isArchived ?? false;
        const base = await svc.getCompanies({ isArchived }, req.user, req.client, req.conn);
        const q = args.query.trim().toLowerCase();
        const items = (base?.items ?? []).filter((c) => {
            const text = [
                c.name, c.industry, c.size, c.description, c.about, c.policyBenefits, c.website,
                ...(Array.isArray(c.faqs) ? c.faqs : []),
            ].filter(Boolean).join(' ').toLowerCase();
            return text.includes(q);
        });
        return JSON.stringify({ ok: true, code: 200, items });
    },
});

export const archiveCompany = tool({
    name: 'archive_company',
    description: 'Soft-delete (archive) a company by id.',
    parameters: z.object({ id: z.string() }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const res = await svc.archiveCompany({ id: args.id }, req.user, req.client, req.conn);
        return JSON.stringify(res);
    },
});

export const unarchiveCompany = tool({
    name: 'unarchive_company',
    description: 'Unarchive a company by id.',
    parameters: z.object({ id: z.string() }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const res = await svc.updateCompany({ id: args.id, isArchived: false }, req.user, req.client, req.conn, true);
        return JSON.stringify(res);
    },
});
