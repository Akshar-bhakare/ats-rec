import { tool } from '@openai/agents';
import { z } from 'zod';
import mongoose from 'mongoose';
import JobService from '../services/jobService.js';
import ScriptService from '../services/scriptService.js';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const jobService = new JobService();
const scriptService = new ScriptService();
const ttsClient = new TextToSpeechClient();

// Agents SDK passes your payload under ctx.context
const getReq = (ctx) => (ctx?.req ?? ctx?.context?.req ?? null);
const getWs = (ctx) => (ctx?.ws ?? ctx?.context?.ws ?? null);

export const listOrSearchJobs = tool({
    name: 'list_Or_Search_Jobs',
    description: "Search or list in jobs by passing filter and fields to mongoose's .find function; Allowed fields to search are: [_id, company, jobType, workMode, isWalkIn, locations, experience, salary, primarySkills, recruiterNotes, description, isArchived]. You can otherOptions for operations like skip, limit, etc. ... ",
    parameters: z.object({
        filter: z.object({}).nullable(),
        fields: z.array(z.string()).nullable(),
        otherOptions: z.object({}).nullable(),
    }),

    async execute(args, ctx) {
        try {
            const req = getReq(ctx);
            const filter = { ...args?.filter || {}, client: req.client };
            const projection = (args?.fields && Array.isArray(args?.fields) ? args?.fields.join(" ") : 'company jobType workMode isWalkIn locations experience salary primarySkills recruiterNotes description isArchived');

            const jobLists = projection?.includes('company')
                ? await req?.conn?.models?.[jobService.ModelName]
                    ?.find?.(filter, projection, args?.otherOptions)
                    ?.populate?.({ path: 'company', model: "Company", select: "name" })
                    ?.lean?.()
                    ?.exec?.()
                : await req?.conn?.models?.[jobService.ModelName]
                    ?.find?.(filter, projection, args?.otherOptions)
                    ?.lean?.()
                    ?.exec?.();

            if (jobLists) {
                if (Array.isArray(jobLists) && jobLists?.length === 0) {
                    return JSON.stringify({
                        ok: true,
                        code: 204,
                        message: "Jobs data not found, try changing filter(s)...",
                        items: jobLists,
                    });
                }

                return JSON.stringify({
                    ok: true,
                    code: 200,
                    message: "Successfully fetched jobs data...",
                    items: jobLists,
                });

            } else {
                return JSON.stringify({
                    ok: false,
                    code: 400,
                    message: "Data not found..."
                });

            }

        } catch (err) {
            return JSON.stringify({
                ok: false,
                code: 400,
                message: err?.message || "Error in getting data...",
            });
        }
    }

});

/**
 * NEW: clone_job
 * Use this when the user says things like:
 * "Create a new job same as this Full Stack Developer job, but location Mumbai"
 */
export const cloneJob = tool({
    name: 'clone_job',
    description: 'Clone an existing job and optionally override some fields (like location, title, etc).',
    parameters: z.object({
        sourceJobId: z.string(),
        overrides: z.object({
            // ★ NOTE: every field that is not mandatory = nullable()
            title: z.string().nullable(),
            internalTitle: z.string().nullable(),
            company: z.string().nullable(),
            jobType: z.string().nullable(),
            workMode: z.string().nullable(),
            locations: z.array(z.string()).nullable(),
            primarySkills: z.array(z.string()).nullable(),
            secondarySkills: z.array(z.string()).nullable(),
            description: z.string().nullable(),
            recruiterNotes: z.string().nullable(),
            positions: z.number().nullable(),
            hybridDetails: z.string().nullable(),
            experience: z.object({
                min: z.number().nullable(),
                max: z.number().nullable(),
            }).nullable(),
            salary: z.object({
                min: z.number().nullable(),
                max: z.number().nullable(),
                currency: z.string().nullable(),
            }).nullable(),
            isWalkIn: z.boolean().nullable(),
            walkInDetails: z.object({
                dateRange: z.object({
                    from: z.coerce.date().nullable(),
                    to: z.coerce.date().nullable(),
                }).nullable(),
                timeRange: z.object({
                    start: z.string().nullable(),
                    end: z.string().nullable(),
                }).nullable(),
                interviewMode: z.string().nullable(),
                venue: z.string().nullable(),
            }).nullable(),
            educationDetails: z.array(
                z.object({
                    level: z.string().nullable(),
                    qualification: z.array(z.string()).nullable(),
                    streamOrSpecialization: z.string().nullable(),
                    boardOrInstitute: z.array(z.string()).nullable(),
                    yearOfCompletion: z.string().nullable(),
                    gradeType: z.string().nullable(),
                    gradeValue: z.string().nullable(),
                })
            ).nullable(),
            certifications: z.array(z.string()).nullable(),
        }).nullable(),
    }),
    async execute(args, ctx) {
        const req = ctx?.req ?? ctx?.context?.req;
        const { sourceJobId, overrides = {} } = args || {};

        // read original job
        const origRes = await jobService.getJobDetails({ id: sourceJobId }, req.user, req.client, req.conn);
        if (!origRes?.ok || !origRes?.details?.job) {
            return JSON.stringify({
                ok: false,
                code: origRes?.code || 404,
                message: origRes?.message || 'Source job not found',
            });
        }

        const src = origRes.details.job;

        // shallow clone + overrides
        const payload = {
            ...src,
            ...overrides,
            // force new job semantics
            _id: undefined,
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            isArchived: false,
            status: 'active',
        };

        // JobService.createJob expects Mongoose-shaped payload
        const createRes = await jobService.createJob(payload, req.user, req.client, req.conn);
        return JSON.stringify(createRes);
    },
});

export const createJobFromFrontend = tool({
    name: 'create_job_from_frontend',
    description: "Creates a new job for the current client by managing state of frontend's New Job Creation form. " +
        "This tool HYDRATEs the frontend form (newJobCreationData) and prepare a backend payload, " +
        "but MUST NOT actually submit the job. After this, the user should review & confirm before submit_job_creation_or_update_form is called." +
        "Do NOT miss or pass false positive values to any required fields, do use other needful tools for it" +
        `
        Frontend(ReactJS) job creation form's Global state variables(keys) available to change:
        
        jobInitialValuesDict (The job change form state variable where all input fields in it, by default 
        
            {
                "title": "",
                "internalTitle": "",
                "company": "", // a company id from companies in our system, get it from companies list tool.
                "positions": "",
                "jobType": "", // options: ['Full-time', 'Part-time', 'Permanent', 'Fresher', 'Contractual/Temporary', 'Internship'].
                "workMode": "", // options: ['On-site(Work From Office)', 'Hybrid', 'Remote(Work From Home)', 'Field-based', 'Not specified'].
                "hybridDetails": "" // Must always send this hybridDetails(e.g. "3 days WFO, 2 days WFH", etc.) if only workMode is set to "Hybrid".
                "locations": [],
                "locationInput": "",
                "minSalary": "",
                "maxSalary": "",
                "minExp": "",
                "maxExp": "",
                "educations": [
                    {
                        "level": "",
                        "degree": "",
                        "institute": "",
                        "field": "",
                        "score": "",
                        "college": "",
                        "yearOfCompletion": ""
                    }
                ],
                "skills": [], // only three skils, not greater or less than that.
                "description": "",
                "notes": "",
                "scriptJob": "",
                "scriptName": "",
                "scriptType": "aicall",
                "scriptExtra": "",
                "scriptContent": "",
                "scriptLang": "en-IN", // use getScriptLangAndVoiceOptions tool for options.
                "scriptVoice": "en-IN-Chirp-HD-F" // use getScriptLangAndVoiceOptions tool for options.
            }

        )

        format of newJobCreationData with what is required in zod type(zod as z):

        z.object({
            title: z.string(),
            jobType: z.string(),
            workMode: z.string(),
            locations: z.array(z.string()),
            primarySkills: z.array(z.string()),
            description: z.string(),
            company: z.string(),
            internalTitle: z.string().nullable(),
            positions: z.number().nullable(),
            experience: z.object({
                min: z.number(),
                max: z.number(),
            }),
            scriptName: z.string(),
            scriptContent: z.string(),
            salary: z.object({
                min: z.number().nullable(),
                max: z.number().nullable(),
                currency: z.string().nullable(),
            }).nullable(),
            hybridDetails: z.string().nullable(),
            educationDetails: z.array(z.object({
                level: z.string().nullable(),
                qualification: z.array(z.string()).nullable(),
                streamOrSpecialization: z.string().nullable(),
                boardOrInstitute: z.array(z.string()).nullable(),
                yearOfCompletion: z.string().nullable(),
                gradeType: z.string().nullable(),
                gradeValue: z.string().nullable(),
            })
            ).nullable(),
            certifications: z.array(z.string()).nullable(),
            secondarySkills: z.array(z.string()).nullable(),
            recruiterNotes: z.string().nullable(),
            walkInDetails: z.object({
                dateRange: z.object({
                    from: z.coerce.date().nullable(),
                    to: z.coerce.date().nullable(),
                }).nullable(),
                timeRange: z.object({
                    start: z.string().nullable(),
                    end: z.string().nullable(),
                }).nullable(),
                interviewMode: z.string().nullable(),
                venue: z.string().nullable(),
            }).nullable(),
        })

        `,
    parameters: z.object({
        title: z.string(),
        jobType: z.string(),
        workMode: z.string(),
        locations: z.array(z.string()),
        skills: z.array(z.string()),
        description: z.string(),
        company: z.string(),
        internalTitle: z.string().nullable(),
        positions: z.number().nullable(),
        minExp: z.number(),
        maxExp: z.number(),
        scriptName: z.string(),
        scriptContent: z.string(),
        scriptType: z.string(),
        scriptLang: z.string(),
        scriptVoice: z.string(),
        minSalary: z.number().nullable(),
        maxSalary: z.number().nullable(),
        hybridDetails: z.string().nullable(),
        educationDetails: z.array(z.object({
            level: z.string().nullable(),
            degree: z.array(z.string()).nullable(),
            institute: z.array(z.string()).nullable(),
            field: z.string().nullable(),
            score: z.string().nullable(),
            college: z.array(z.string()).nullable(),
            yearOfCompletion: z.string().nullable(),
        })
        ).nullable(),
        certifications: z.array(z.string()).nullable(),
        secondarySkills: z.array(z.string()).nullable(),
        notes: z.string().nullable(),
        walkInDetails: z.object({
            dateRange: z.object({
                from: z.coerce.date().nullable(),
                to: z.coerce.date().nullable(),
            }).nullable(),
            timeRange: z.object({
                start: z.string().nullable(),
                end: z.string().nullable(),
            }).nullable(),
            interviewMode: z.string().nullable(),
            venue: z.string().nullable(),
        }).nullable(),
    }),
    async execute(args, ctx) {
        const ws = getWs(ctx);
        const req = getReq(ctx);

        console.log('[tool:create_job_from_frontend] called with args:', JSON.stringify(args, null, 2));
        console.log('[tool:create_job_from_frontend] ctx keys:', Object.keys(ctx || {}));
        console.log('[tool:create_job_from_frontend] ws present?', !!ws);

        // 1) Hydrate frontend job form so user can see/edit the draft
        if (ws?.send) {
            const scriptName =
                (args.scriptName && String(args.scriptName).trim()) || 'Dummy Script';

            const educations =
                Array.isArray(args.educationDetails) && args.educationDetails.length
                    ? args.educationDetails.map((ed) => ({
                        level: ed.level || '',
                        degree: Array.isArray(ed.degree)
                            ? ed.degree
                            : ed.degree
                                ? [ed.degree]
                                : [],
                        institute: Array.isArray(ed.institute)
                            ? ed.institute.join(';')
                            : (ed.institute || ''),
                        field: ed.field || '',
                        score: ed.score || '',
                        college: Array.isArray(ed.college)
                            ? ed.college.join(';')
                            : (ed.college || ''),
                        yearOfCompletion: ed.yearOfCompletion || '',
                    }))
                    : [
                        {
                            level: '',
                            degree: [],
                            institute: '',
                            field: '',
                            score: '',
                            college: '',
                            yearOfCompletion: '',
                        },
                    ];

            const jobInitialValuesDict = {
                ...args,
                title: args.title,
                internalTitle: args.internalTitle ?? '',
                company: args.company,
                positions: args.positions != null ? String(args.positions) : '',
                jobType: args.jobType,
                workMode: args.workMode,
                locations: args.locations || [],
                locationInput: '',
                minSalary: args.minSalary != null ? String(args.minSalary) : '',
                maxSalary: args.maxSalary != null ? String(args.maxSalary) : '',
                minExp: String(args.minExp ?? ''),
                maxExp: String(args.maxExp ?? ''),
                educations,
                skills: args.skills || [],
                skillInput: '',
                description: args.description || '',
                notes: args.notes || '',
                scriptJob: '',
                scriptName,
                scriptType: args.scriptType || 'AI Call',
                scriptExtra: '',
                scriptContent: args.scriptContent || '',
                scriptLang: args.scriptLang || 'en-IN',
                scriptVoice: args.scriptVoice || 'en-IN-Chirp3-HD-Aoede',
            };

            const payloadToFrontend = {
                event: 'frontendActionChangeGState',
                from: 'create_job_from_frontend',
                setGState: {
                    jobInitialValuesDict,
                },
            };

            console.log('[tool:create_job_from_frontend] sending WS payload:', JSON.stringify(payloadToFrontend, null, 4));

            ws.send(JSON.stringify(payloadToFrontend));
        } else {
            console.log('[tool:create_job_from_frontend] NO ws found in ctx, cannot hydrate form');
        }

        const createJobRes = {
            ok: true,
            code: 200,
            message:
                "Job draft prepared and sent to frontend form. Ask the user to review, then call submit_job_creation_or_update_form ONLY after explicit confirmation of submition",
        };

        console.log('[tool:create_job_from_frontend] returning:', createJobRes);
        return JSON.stringify(createJobRes);
    }
});


export const updateJobFromFrontend = tool({
    name: 'update_job_from_frontend',
    description: "Update a job for the current client by managing state of frontend's Job change form." +
        `
        Frontend(ReactJS) job change form's Global state variables(keys) available to change:

        _id - Existing job id required when updating specific job(you can get it from job your listing tool named: list_Or_Search_Jobs), else only fields to be changed as per user request.

        Note: currently all fields set optional so, you can able to change a single field also at one time.
        Important Instructions: Give only that fields which are changed. And unchanged fields not sent in arguments or should be "null" type only.
        `,
    parameters: z.object({
        _id: z.string().nullable(),
        title: z.string().nullable(),
        jobType: z.string().nullable(),
        workMode: z.string().nullable(),
        locations: z.array(z.string()).nullable(),
        skills: z.array(z.string()).nullable(),
        description: z.string().nullable(),
        company: z.string().nullable(),
        internalTitle: z.string().nullable(),
        positions: z.number().nullable(),
        minExp: z.number().nullable(),
        maxExp: z.number().nullable(),
        scriptName: z.string().nullable(),
        scriptContent: z.string().nullable(),
        scriptType: z.string().nullable(),
        scriptLang: z.string().nullable(),
        scriptVoice: z.string().nullable(),
        minSalary: z.number().nullable(),
        maxSalary: z.number().nullable(),
        hybridDetails: z.string().nullable(),
        educationDetails: z.array(z.object({
            level: z.string().nullable(),
            degree: z.array(z.string()).nullable(),
            institute: z.array(z.string()).nullable(),
            field: z.string().nullable(),
            score: z.string().nullable(),
            college: z.array(z.string()).nullable(),
            yearOfCompletion: z.string().nullable(),
        })
        ).nullable(),
        certifications: z.array(z.string()).nullable(),
        secondarySkills: z.array(z.string()).nullable(),
        notes: z.string().nullable(),
        walkInDetails: z.object({
            dateRange: z.object({
                from: z.coerce.date().nullable(),
                to: z.coerce.date().nullable(),
            }).nullable(),
            timeRange: z.object({
                start: z.string().nullable(),
                end: z.string().nullable(),
            }).nullable(),
            interviewMode: z.string().nullable(),
            venue: z.string().nullable(),
        }).nullable(),
    }),
    async execute(args, ctx) {
        const ws = getWs(ctx);

        const changed = {};

        Object.keys(args).forEach(keyEle => {

            if (Array.isArray(args[keyEle]) && args[keyEle]?.length > 0) {
                changed[keyEle] = args[keyEle];

            } else if (args[keyEle] && !Array.isArray(args[keyEle])) {
                changed[keyEle] = args[keyEle];

            }
        });

        if (ws?.send) {
            ws.send(JSON.stringify({
                event: 'frontendActionChangeJobUpdateGState',
                setGState: changed,
            }));
        } else {
            return JSON.stringify({
                ok: false,
                code: 400,
                message: "Websocket connection not found for perform this action..."
            });
        }

        const createJobRes = {
            ok: true,
            code: 200,
            message: "Given data changed the frontend's state, get confirmation from user to submit the form...",
        };

        return JSON.stringify(createJobRes);
    }
});

export const getScriptLangAndVoiceOptions = tool({
    name: 'get_script_lang_and_voice_options',
    description: "get script lang and voice options for create or change a job.",
    parameters: z.object({}),
    async execute(args, ctx) {
        try {
            const [response] = await ttsClient.listVoices();
            const voices = response.voices || [];

            const languages = Array.from(
                new Set(voices.flatMap(v => v.languageCodes || []))
            );

            const voiceModels = voices.map(v => ({
                name: v.name,
                language: v.languageCodes ? v.languageCodes[0] : 'Unknown',
                gender: v.ssmlGender || 'UNKNOWN',
                model: v.name.includes('WaveNet') ? 'wavenet' : 'standard',
            }));

            return JSON.stringify({ ok: true, code: 200, details: { scriptLangOptions: languages, scriptVoiceOptions: voiceModels } });
        } catch (error) {
            return JSON.stringify({ ok: false, code: 400, message: error.message });
        }
    }
});

export const goToJobCreationOrUpdateFormNextStep = tool({
    name: 'Go_To_Job_Creation_Or_Update_Form_Next_Step',
    description: "This tool triggers click event on id 'id_job_form_submit' so it submit a new creation or update the job create or edit form, for the current client.",
    parameters: z.object({}),
    async execute(args, ctx) {
        const ws = getWs(ctx);

        // Fallback: legacy behavior for manual UI flow
        if (ws?.send) {
            ws.send(JSON.stringify({
                event: 'frontendActionNextStepJobForm',
                args,
            }));
        } else {
            return JSON.stringify({
                ok: false,
                code: 400,
                message: "Websocket connection not found for perform this action..."
            });
        }

        const submitJobRes = {
            ok: true,
            code: 200,
            message: "The user was taken to the next stage of the form...",
        };

        return JSON.stringify(submitJobRes);

    }
});

export const submitJobCreationOrUpdateForm = tool({
    name: 'submit_job_creation_or_update_form',
    description: "This tool triggers click event on id 'id_job_form_submit' so it submit a new creation or update the job create or edit form, for the current client.",
    parameters: z.object({}),
    async execute(args, ctx) {
        const ws = getWs(ctx);
        const req = getReq(ctx);
        const clsObj = ctx?.context?.clsObj;

        // Fallback: legacy behavior for manual UI flow
        if (ws?.send) {
            ws.send(JSON.stringify({
                event: 'frontendActionSubmitJobCreationForm',
                args,
            }));
        } else {
            return JSON.stringify({
                ok: false,
                code: 400,
                message: "Websocket connection not found for perform this action..."
            });
        }

        const submitJobRes = {
            ok: true,
            code: 200,
            message: "Job form submition requested successfully...",
        };

        return JSON.stringify(submitJobRes);

    }
});

export const archiveJob = tool({
    name: 'archive_job',
    description: "Archive a new job of the current client.",
    parameters: z.object({
        id: z.string(),
    }),
    async execute(args, ctx) {
        console.log(
            "args: ", args
        );

        const req = getReq(ctx);
        const archiveJobRes = await jobService.archiveJob(args, req.user, req.client, req.conn);

        return JSON.stringify(archiveJobRes);

    }
});
