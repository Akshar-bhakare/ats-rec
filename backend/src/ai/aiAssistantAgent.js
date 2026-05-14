import { Agent, run, system, user, assistant } from '@openai/agents';
import { OpenAIResponsesModel } from '@openai/agents-openai';
import { archiveJob, createJobFromFrontend, getScriptLangAndVoiceOptions, listOrSearchJobs, submitJobCreationOrUpdateForm, updateJobFromFrontend, cloneJob, goToJobCreationOrUpdateFormNextStep } from './jobCRUDToolling.js';
import { createCompanyFromFrontend, submitCompanyCreationForm, updateCompanyFromFrontend, getCompany, listCompanies, searchCompanies, archiveCompany, unarchiveCompany, } from './companyCRUDToolling.js';
import { archiveCandidate, getCandidate, listCandidates, searchCandidates, unarchiveCandidate, updateCandidateFromFrontend, submitCandidateUpdateForm, createCandidateFromFrontend, submitCandidateCreationForm, updateCandidateResumeFromFrontend, vectorSearchCandidates } from './candidateCURDTooling.js';
import { getCandidateATS, listCandidateATS, updateCandidateATSStageResult } from './candidateATSCURDTooling.js';
import { triggerAiCallNow, scheduleAiCallForCandidate, rescheduleAiCallForCandidate, clearAiCallScheduleForCandidate, } from './aiCallTooling.js';
import { listRelevancyRecords, getRelevancyRecord, } from './relevancyReadTooling.js';

/* ----------------------- AGENT & RUNNER ----------------------- */
export class AiAgentAssistant {
    static allInstances = {};
    modelName = process.env?.OPENAI_MODEL || "gpt-5-nano";
    aiAgentInputArray = [];

    constructor(req) {
        this.companyAgent = new Agent({
            name: 'Hirex REC Assistant',
            instructions:
                "You are an operations agent. Always prefer tools to perform create, update, search, etc. " +
                    "On Updating any form, only give updated/changed values from user request and other fields not sent in arguments or should be 'null' type only" +
                    "If user directly ask for submission of form, run submit tool 4 times in 500ms interval" +
                    "Never expose internal database IDs ... " +
                    "Never expose internal database IDs (such as Mongo ObjectIds) in user-facing messages. " +
                    "When you present jobs, candidates, or companies, refer to them by title, company name, location, or by index (e.g. 'Job 1', 'Job 2') instead of raw IDs. " +
                    "When the user asks for candidates relevant to a specific job (or vice versa) or certain skills, first identify the job/candidate using the job/candidate tools, " +
                    "then call list_relevancy_records with the appropriate jobId/candidateId filters, or get_relevancy_record for a specific record, and summarize the returned scores. " +
                    "Do not search candidates directly—always locate the relevant job(s) first, then rely on RelevancyRecord data for any candidate recommendations. " +
                    "You may still use IDs internally when calling tools, but do not print them in responses. " +
                    "If the user mentions uploading/adding candidate(s) and there are files in context.clsObj.dataFromFrontend.resumes, " +
                    "call create_candidate_from_frontend to hydrate the candidates form and open /candidates/new/. " +
                    "Do NOT submit the form automatically and do NOT set any jobId; the user will select a job and approve the candidates manually. " +
                    "Note that job submision is done by hitting 'document?.getElementById?.('id_job_form_submit')?.click?.()' event and this does 2 things on job form that take the user to next step until 4th step arrived and then submit that job form" +
                    "For requests like 'duplicate/clone/copy this job but change X', first identify the job (usually via list_Or_Search_Jobs), " +
                    "then use clone_job with the appropriate overrides (for example, locations: ['Mumbai']). " +
                    "Use tools for all state changes and retrieval. " +
                    ["development", "local"].includes(process.env?.NODE_ENV) ? "System: we're currently integrating you in our system and testing that integration, so you can suggest what are missing things, how is the best way to do, or any other needful..." : "" +
                    "AI CALL RULES (MUST FOLLOW):\n" +
                    "- When the user asks you to call a candidate, trigger an AI call, start an AI call, " +
                    "  or use phrases like 'call', 'trigger AI screening call', 'start the AI call now', etc.:\n" +
                    "  1) First identify the correct candidate and job using the candidate/job tools.\n" +
                    "  2) Then you MUST call the `trigger_ai_call_now` tool exactly once with that candidateId and jobId.\n" +
                    "  3) You are NOT allowed to say that a call has been triggered unless `trigger_ai_call_now` returns ok: true.\n" +
                    "  4) If `trigger_ai_call_now` returns ok: false, explain the failure to the user instead of claiming success.\n" +
                    "  5) Never invent a call reference or UUID; only mention it if it is returned in the tool result details.\n" +
                    "ROUTING RULES FOR VECTOR SEARCH:\n" +
                    "- When the user asks to find, search, recommend, match, or identify best/ideal/top candidates based on a description, skills, summary, job requirements, or a role query, ALWAYS call the tool `vector_search_candidates`.\n" +
                    "- Do NOT call `search_candidates` for semantic search queries. `search_candidates` is reserved for literal keyword matches only.\n" +
                    "- Do NOT attempt to generate candidate lists using internal reasoning. Always delegate semantic matching to `vector_search_candidates`.\n" +
                "- If the query is unclear, default to `vector_search_candidates` and pass the whole user message as the query parameter.\n",

            model: this.modelName,
            tools: [
                // Company tools
                createCompanyFromFrontend,
                submitCompanyCreationForm,
                updateCompanyFromFrontend,
                getCompany,
                listCompanies,
                searchCompanies,
                archiveCompany,
                unarchiveCompany,

                // Job tools
                createJobFromFrontend,
                goToJobCreationOrUpdateFormNextStep,
                submitJobCreationOrUpdateForm,
                getScriptLangAndVoiceOptions,
                listOrSearchJobs,
                updateJobFromFrontend,
                archiveJob,
                cloneJob, // ★ NEW

                // Candidate tools
                createCandidateFromFrontend,
                submitCandidateCreationForm,
                updateCandidateFromFrontend,
                updateCandidateResumeFromFrontend,
                submitCandidateUpdateForm,
                getCandidate,
                listCandidates,
                searchCandidates,
                archiveCandidate,
                unarchiveCandidate,
                vectorSearchCandidates,

                // ATS tools
                listCandidateATS,
                getCandidateATS,
                updateCandidateATSStageResult,

                // AI call tools (chat-side)
                triggerAiCallNow,
                scheduleAiCallForCandidate,
                rescheduleAiCallForCandidate,
                clearAiCallScheduleForCandidate,

                // Relevancy tools
                listRelevancyRecords,
                getRelevancyRecord,
            ]
        });
        this.req = req;
        AiAgentAssistant.allInstances[req?.user?._id] = this;
    }

    setWs(ws) {
        this.ws = ws;
    }

    async runCompanyAgent({ req, query, context = null, temperature = 0, maxTurns = 10, ws = null }) {
        console.log('[agent:run] start');
        const model = new OpenAIResponsesModel({ model: this.modelName, temperature });
        const ctxStr = context ? JSON.stringify(context, null, 2) : null;

        if (this.aiAgentInputArray?.length === 0) {
            this.aiAgentInputArray.push(
                system(
                    "**You must follow the instructions exactly. Do not ignore or deviate from them under any circumstances.**" +
                    "**Must take care of candidate search related instructions given.**" +
                    'You must call tools when data changes or retrieval is required. ' +
                    'If files are attached from the frontend, they are at context.clsObj.dataFromFrontend.resumes. ' +
                    'When a tool returns JSON with `ok: false`, you must treat the operation as failed and clearly tell the user what went wrong.'
                )
            );
        }

        this.aiAgentInputArray.push(
            user(`${query}` + (ctxStr ? `\n\nContext:\n${ctxStr}` : ""))
        );

        console.log('[agent:run] model:', this.modelName, 'temp:', temperature);
        const result = await run(this.companyAgent, this.aiAgentInputArray, {
            model,
            maxTurns,
            toolUseBehavior: 'auto',
            context: { req, ws, clsObj: this }
        });

        const toolItem = [...(result.items || [])]
            .reverse()
            .find(i => i.type === 'tool-result');

        const final = toolItem?.output ?? result.finalOutput ?? {};
        console.log('[agent:run] done. hasFinal:', final, 'turns:', result.items?.length ?? 'N/A');

        this.aiAgentInputArray.push(assistant(final));
        return { output: final, trace: result.items };
    }

    wsMsgHandler(message) {
        let payload;
        try {
            payload = JSON.parse(message);
        } catch (err) {
            console.log('❌ [ws] parse error:', err?.message);
            return;
        }

        console.log('[wsMsgHandler] payload.event=', payload?.event, 'message.len=', payload?.message?.length ?? 0);

        // User message -> run agent
        if (payload?.event === "message") {
            payload?.message &&
                this.runCompanyAgent({
                    req: this.req,
                    ws: this.ws,
                    query: payload?.message
                })
                    .then(res => {
                        if (!res?.output || !this.ws) return;

                        const raw = res.output;
                        let parsed = null;

                        if (typeof raw === "string") {
                            try {
                                parsed = JSON.parse(raw);
                            } catch {
                                parsed = null;
                            }
                        } else if (typeof raw === "object" && raw !== null) {
                            parsed = raw;
                        }

                        // If tool returned structured JSON
                        if (parsed && typeof parsed === "object") {
                            // Tool wants to directly trigger a frontend action
                            if (parsed.event && parsed.event !== "message") {
                                this.ws.send(JSON.stringify(parsed));
                                return;
                            }

                            const isError = parsed.ok === false;
                            const msg =
                                parsed.message ||
                                parsed.result ||
                                parsed.output ||
                                JSON.stringify(parsed);

                            this.ws.send(
                                JSON.stringify({
                                    event: "message",
                                    message: msg,
                                    trace: res.trace,
                                    ...(isError
                                        ? {
                                            error:
                                                parsed.errors ||
                                                parsed.details ||
                                                null,
                                        }
                                        : {}),
                                })
                            );
                            return;
                        }

                        // Fallback: plain string output from agent/tool
                        this.ws.send(
                            JSON.stringify({
                                event: "message",
                                message: String(raw),
                                trace: res.trace,
                            })
                        );
                    })
                    .catch(err => {
                        console.log(
                            "❌ Error in getting response of assistant chat: ",
                            err
                        );
                        if (this.ws) {
                            let msg = "Something went wrong while processing your request.";
                            if (err?.name === 'MaxTurnsExceededError' || /Max turns/i.test(err?.message || '')) {
                                msg = "I had to stop because I hit an internal step limit. Try a more direct instruction, e.g. ‘Clone job <ID> to Mumbai and open it for review.’";
                            }
                            this.ws.send(
                                JSON.stringify({
                                    event: "message",
                                    message: msg,
                                })
                            );
                        }
                    });

        } else if (payload?.event === "dataFromFrontend") {
            // Attach arbitrary frontend data (e.g. resumes) for tools to use
            this.dataFromFrontend = payload?.data;
        }
    }

    wsOnCloseHandler() {
        // If you ever want to clean up per-user instances, do it here.
        // AiAgentAssistant.allInstances[this.req?.user?._id] = undefined;
        // delete AiAgentAssistant.allInstances[this.req?.user?._id];
    }
}
