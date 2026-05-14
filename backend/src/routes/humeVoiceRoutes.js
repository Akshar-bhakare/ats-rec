// backend/src/routes/humeVoiceRoutes.js

export default async function humeVoiceRoutes(fastify) {

    fastify.addHook('preHandler', fastify.authenticate);

    // POST preview — calls Hume Octave TTS and returns base64 audio
    // Voice is controlled entirely via the `description` field (natural language).
    fastify.post('/preview', async (req, reply) => {
        const { text, description, speed } = req.body || {};

        if (!text || !text.trim()) {
            return reply.code(400).send({ error: 'Missing required field: text' });
        }

        const apiKey = process.env.HUME_API_KEY;
        if (!apiKey) {
            return reply.code(500).send({ error: 'HUME_API_KEY is not configured on the server' });
        }

        try {
            const body = {
                utterances: [
                    {
                        text: text.trim().slice(0, 2000),
                        ...(description && description.trim() && { description: description.trim().slice(0, 500) }),
                        ...(speed && { speed: Math.min(Math.max(Number(speed), 0.25), 3.0) }),
                    }
                ],
                format: { type: 'mp3' },
                num_generations: 1,
            };

            const res = await fetch('https://api.hume.ai/v0/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Hume-Api-Key': apiKey,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('[hume-voice] API error:', res.status, errText);
                return reply.code(res.status).send({ error: 'Hume AI TTS failed', details: errText });
            }

            const data = await res.json();
            const audio = data?.generations?.[0]?.audio;

            if (!audio) {
                return reply.code(500).send({ error: 'Hume AI returned no audio' });
            }

            return reply.send({ audioBase64: audio });

        } catch (err) {
            console.error('[hume-voice] preview error:', err.message);
            return reply.code(500).send({ error: 'Hume AI TTS failed', details: err.message });
        }
    });
}
