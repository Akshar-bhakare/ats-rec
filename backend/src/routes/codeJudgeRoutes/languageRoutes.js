

export default async function languageRoutes(fastify, options) {
    // Keep tenant context in sync with other Code Judge routes
    fastify.addHook('preHandler', fastify.authenticate);

    /**
     * GET /api/codejudge/languages
     * Fetch all active languages
     * 
     * Languages are automatically synced from Judge0 CE on backend startup,
     * so they are guaranteed to be available in the database.
     */
    fastify.get('/languages', async (req, reply) => {
        try {
            // Fetch directly from Judge0 or use supported list
            // Since we need to expose only supported languages, we can just return the static list
            // or fetch from Judge0 and filter.
            // For now, let's return the supported list which maps to Judge0 IDs.

            const { SUPPORTED_LANGUAGES } = await import('../../utils/supportedLanguages.js');

            // Transform to array format expected by frontend
            const languages = Object.entries(SUPPORTED_LANGUAGES).map(([id, name]) => {
                // Heuristic for extension and version based on name
                // e.g. "C++ (GCC 9.2.0)" -> name="C++", version="GCC 9.2.0"
                const nameParts = name.match(/^(.+?)\s*\((.+)\)$/);
                const simpleName = nameParts ? nameParts[1] : name;
                const version = nameParts ? nameParts[2] : '';

                let extension = '';
                if (simpleName.includes('C++')) extension = '.cpp';
                else if (simpleName.includes('C')) extension = '.c';
                else if (simpleName.includes('Python')) extension = '.py';
                else if (simpleName.includes('Java')) extension = '.java';
                else if (simpleName.includes('JavaScript')) extension = '.js'; // vs node
                else if (simpleName.includes('Go')) extension = '.go';
                else if (simpleName.includes('Rust')) extension = '.rs';
                // ... add others as needed or just leave empty if frontend doesn't strictly need it for display

                return {
                    _id: parseInt(id, 10), // For frontend compatibility
                    judge0Id: parseInt(id, 10),
                    name: simpleName,
                    version: version,
                    extension: extension
                };
            }).sort((a, b) => a.name.localeCompare(b.name));

            return reply.send(languages);

        } catch (err) {
            console.error('[LANGUAGE ROUTES] Failed to fetch languages:', err);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: 'Failed to fetch languages'
            });
        }
    });
}
    