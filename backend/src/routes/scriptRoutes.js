// backend/src/routes/scriptRoutes.js
import mongoose from 'mongoose';
import textToSpeech from '@google-cloud/text-to-speech';

import ScriptService from '../services/scriptService.js';
import universalTextToSpeech from '../utils/googleTTSAndSTTUtils.js';

const ttsClient = new textToSpeech.TextToSpeechClient();

export default async function scriptRoutes(fastify) {
    const svc = new ScriptService();

    fastify.addHook('preHandler', fastify.authenticate);

    // CREATE a new Script
    fastify.post('/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const {
            jobId,
            scriptName,
            scriptType,
            extraQuestion,
            content,
            language,
            gender,
            voiceModel,
            openaiVoice,
            openaiInstructions,
        } = req.body;

        const missing = [
            'jobId',
            'scriptName',
            'scriptType',
            'content',
            'language',
            'gender',
            'voiceModel',
        ].filter(f => !req.body[f]);

        if (missing.length)
            return reply.code(400).send({ error: `Missing field(s): ${missing.join(', ')}` });

        if (!mongoose.Types.ObjectId.isValid(jobId))
            return reply.code(400).send({ error: 'Invalid jobId format' });

        const jobExists = await req.conn.models.Job.exists({ _id: jobId });
        if (!jobExists)
            return reply.code(400).send({ error: 'Referenced Job does not exist' });

        const dup = await req.conn.models.Script.findOne({ jobId }).lean();
        if (dup)
            return reply.code(409).send({ error: 'A script for this job already exists.' });

        let script;
        try {
            script = await svc.create(
                {
                    jobId,
                    scriptName,
                    scriptType,
                    extraQuestion,
                    content,
                    language,
                    gender,
                    voiceModel,
                    ...(openaiVoice && { openaiVoice }),
                    ...(openaiInstructions && { openaiInstructions }),
                    client: req.user.sub,
                },
                req
            );
        } catch (err) {
            if (err.name === 'ValidationError')
                return reply.code(400).send({
                    error: 'Invalid script data',
                    details: Object.values(err.errors).map(e => e.message),
                });
            throw err;
        }
        return reply.code(201).send(script);
    });

    // LIST scripts (optionally filter by jobId)
    fastify.get('/', async (req, reply) => {
        const filter = {};
        if (req.query.jobId && mongoose.Types.ObjectId.isValid(req.query.jobId)) {
            filter.jobId = req.query.jobId;
        }
        const list = await req.conn.models['Script'].find(filter).exec();
        return reply.send(list);
    });

    // LIST scripts with job pouplation (filter by jobId)
    fastify.get('/and/jobs/', async (req, reply) => {
        const filter = {};
        if (req.query.jobId && mongoose.Types.ObjectId.isValid(req.query.jobId)) {
            filter.jobId = req.query.jobId;
        }
        const list = await req.conn.models['Script'].find(filter).populate({
            path: "jobId",
            model: "Job",
        }).lean().exec();

        return reply.send(list);
    });

    // READ a single Script
    fastify.get('/:id', async (req, reply) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid Script ID format' });
        }
        const script = await svc.readById(id, req);
        if (!script) {
            return reply.code(404).send({ error: 'Script not found' });
        }
        return reply.send(script);
    });

    // UPDATE a Script
    fastify.put('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid Script ID format' });
        }

        let updated;
        try {
            const {
                scriptName,
                scriptType,
                extraQuestion,
                content,
                language,
                gender,
                voiceModel,
                openaiVoice,
                openaiInstructions,
            } = req.body;

            const payload = {
                scriptName,
                scriptType,
                extraQuestion,
                content,
                language,
                gender,
                voiceModel,
                ...(openaiVoice !== undefined && { openaiVoice }),
                ...(openaiInstructions !== undefined && { openaiInstructions }),
            };
            updated = await svc.update(id, payload, req);
        } catch (err) {
            if (err.name === 'ValidationError') {
                return reply.code(400).send({
                    error: 'Invalid script data',
                    details: Object.values(err.errors).map(e => e.message)
                });
            }
            throw err;
        }
        if (!updated) {
            return reply.code(404).send({ error: 'Script not found' });
        }
        return reply.send(updated);
    });

    // DELETE a Script
    fastify.delete('/:id', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.code(400).send({ error: 'Invalid Script ID format' });
        }
        const existed = await svc.readById(id, req);
        if (!existed) {
            return reply.code(404).send({ error: 'Script not found' });
        }
        await svc.delete(id, req);
        return reply.code(204).send();
    });

    // GENERATE script (AI)
    fastify.post('/generate-script', async (req, reply) => {
        try {
            const { job, jobId, candidateId, extraQuestion } = req.body || {};
            const content = await svc.generateScriptFromJob({
                job,
                jobId,
                candidateId,
                extraQuestion,
                req
            });
            return reply.send({ success: true, content });
        } catch (err) {
            console.log('[generate-script] Error: ', err);
            return reply.code(400).send({
                success: false,
                message: err.message || 'Failed to generate script'
            });
        }
    });

    // GET voice models and languages from Google TTS
    fastify.get('/languages-voices', async (req, reply) => {
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

            return reply.send({ languages, voiceModels });
        } catch (error) {
            return reply.code(400).send({ error: error.message });
        }
    });

    fastify.post('/preview-voice', async (req, reply) => {
        const { text, languageCode, voiceName, ssmlGender } = req.body;
        if (!text || !languageCode || !voiceName) {
            return reply.code(400).send({ error: 'Missing required fields' });
        }

        try {
            const audioBuffer = await universalTextToSpeech(
                text,
                languageCode,
                ssmlGender || 'NEUTRAL',
                voiceName,
                'MP3',
                24000,
                0.90
            );

            if (!audioBuffer || !audioBuffer.length) {
                throw new Error('No audio buffer generated');
            }

            const base64 = audioBuffer.toString('base64');
            return reply.send({ audioBase64: base64 });
        } catch (err) {
            return reply.code(400).send({ error: 'TTS failed', details: err.message });
        }
    });

    fastify.post('/preview-voice-openai', async (req, reply) => {
        const { text, voice, instructions } = req.body;
        if (!text || !voice) {
            return reply.code(400).send({ error: 'Missing required fields: text, voice' });
        }
        const allowed = ['alloy','ash','ballad','coral','echo','fable','onyx','nova','sage','shimmer','verse'];
        if (!allowed.includes(voice.toLowerCase())) {
            return reply.code(400).send({ error: `Invalid voice. Allowed: ${allowed.join(', ')}` });
        }
        try {
            const { default: OpenAI } = await import('openai');
            const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            const ttsParams = {
                model: 'gpt-4o-mini-tts',
                voice: voice.toLowerCase(),
                input: (text || '').slice(0, 4096),
                response_format: 'mp3',
            };

            if (instructions && instructions.trim()) {
                ttsParams.instructions = instructions.slice(0, 4096);
            }

            const response = await openaiClient.audio.speech.create(ttsParams);
            const buffer = Buffer.from(await response.arrayBuffer());
            return reply.send({ audioBase64: buffer.toString('base64') });
        } catch (err) {
            console.error('[preview-voice-openai]', err.message);
            return reply.code(400).send({ error: 'OpenAI TTS failed', details: err.message });
        }
    });
}
