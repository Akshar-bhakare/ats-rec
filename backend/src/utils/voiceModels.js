import textToSpeech from '@google-cloud/text-to-speech';

async function fetchVoices() {
    console.log('[voiceService] Starting fetchVoices');

    const client = new textToSpeech.TextToSpeechClient();

    try {
        console.log('[voiceService] Sending request to Google TTS listVoices API...');
        const [result] = await client.listVoices({});
        const voices = result.voices;
        console.log(`[voiceService] Received ${voices.length} voices from API.`);

        // Extract unique languages and voice models
        const languages = new Set();
        const voiceModels = [];

        voices.forEach((voice, idx) => {
            voice.languages.forEach(lang => languages.add(lang));
            voiceModels.push({
                name: voice.name,
                languageCodes: voice.languages,
                ssmlGender: voice.ssmlGender,
                naturalSampleRateHertz: voice.naturalSampleRateHertz,
            });
            // console.log(`[voiceService] Processed voice #${idx + 1}: ${voice.name}`);
        });

        const languagesArray = Array.from(languages);
        console.log(`[voiceService] Extracted ${languagesArray.length} unique languages.`);

        console.log('[voiceService] fetchVoices completed successfully.');
        return {
            languages: languagesArray,
            voiceModels,
        };
    } catch (error) {
        console.log('[voiceService] ❌ Error fetching voices:', error);
        throw error;
    }
}

module.exports = { fetchVoices };
