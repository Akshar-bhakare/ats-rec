import path from 'path';

const DEFAULT_FILE_NAME = 'unnamed.wav';
const DEFAULT_WAV_SAMPLE_RATE = 8000;
const DEFAULT_WAV_CHANNELS = 1;
const DEFAULT_WAV_BIT_DEPTH = 8;
const DEFAULT_WAV_AUDIO_FORMAT = 7; // 7 = mu-law, 1 = PCM
const MAX_UINT16 = 0xFFFF;
const MAX_UINT32 = 0xFFFFFFFF;
const MAX_WAV_DATA_SIZE = MAX_UINT32 - 36;

/**
 * Sanitize a filename safely for filesystem use.
 * Removes suspicious characters, limits length, and preserves extension.
 */
export function sanitizeFileName(input) {
    try {
        if (typeof input !== 'string') return DEFAULT_FILE_NAME;

        const ext = path.extname(input).toLowerCase();
        const name = path.basename(input, ext);

        // Replace anything not alphanumeric, underscore, hyphen, or dot
        const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');

        // Trim name length to avoid OS path limits
        const trimmed = safeName.substring(0, 200); // 200 to leave room for paths

        // Fall back if it somehow becomes empty
        const finalName = trimmed || 'unnamed';

        // Default extension if missing
        const finalExt = ext && ext.length <= 5 ? ext : '.wav';

        return `${finalName}${finalExt}`;
    } catch (err) {
        console.warn('[fileIOUtils] sanitizeFileName failed, using fallback:', err?.message || err);
        return DEFAULT_FILE_NAME;
    }
}


// export const writeWavHeader = (bufferLength, sampleRate = 8000, channels = 1, bitDepth = 16) => {
//     const byteRate = sampleRate * channels * (bitDepth / 8);
//     const blockAlign = channels * (bitDepth / 8);
//     const dataSize = bufferLength;
//     const buffer = Buffer.alloc(44);
//     buffer.write('RIFF', 0);
//     buffer.writeUInt32LE(36 + dataSize, 4);
//     buffer.write('WAVE', 8);
//     buffer.write('fmt ', 12);
//     buffer.writeUInt32LE(16, 16);
//     buffer.writeUInt16LE(1, 20);
//     buffer.writeUInt16LE(channels, 22);
//     buffer.writeUInt32LE(sampleRate, 24);
//     buffer.writeUInt32LE(byteRate, 28);
//     buffer.writeUInt16LE(blockAlign, 32);
//     buffer.writeUInt16LE(bitDepth, 34);
//     buffer.write('data', 36);
//     buffer.writeUInt32LE(dataSize, 40);
//
//     return buffer;
// }

export const writeWavHeader = (
    bufferLength,
    sampleRate = DEFAULT_WAV_SAMPLE_RATE,
    channels = DEFAULT_WAV_CHANNELS,
    bitDepth = DEFAULT_WAV_BIT_DEPTH,
    audioFormat = DEFAULT_WAV_AUDIO_FORMAT
) => {
    try {
        let dataSize = Number(bufferLength);
        if (!Number.isFinite(dataSize) || dataSize < 0) {
            console.warn('[fileIOUtils] Invalid bufferLength for WAV header, defaulting to 0:', bufferLength);
            dataSize = 0;
        }
        dataSize = Math.floor(dataSize);
        if (dataSize > MAX_WAV_DATA_SIZE) {
            console.warn('[fileIOUtils] bufferLength too large for WAV header, clamping:', dataSize);
            dataSize = MAX_WAV_DATA_SIZE;
        }

        let safeSampleRate = Number(sampleRate);
        if (!Number.isFinite(safeSampleRate) || safeSampleRate <= 0 || safeSampleRate > MAX_UINT32) {
            console.warn('[fileIOUtils] Invalid sampleRate for WAV header, defaulting:', sampleRate);
            safeSampleRate = DEFAULT_WAV_SAMPLE_RATE;
        }
        safeSampleRate = Math.floor(safeSampleRate);

        let safeChannels = Number(channels);
        if (!Number.isFinite(safeChannels) || safeChannels <= 0 || safeChannels > MAX_UINT16) {
            console.warn('[fileIOUtils] Invalid channels for WAV header, defaulting:', channels);
            safeChannels = DEFAULT_WAV_CHANNELS;
        }
        safeChannels = Math.floor(safeChannels);

        let safeBitDepth = Number(bitDepth);
        if (!Number.isFinite(safeBitDepth) || safeBitDepth <= 0 || safeBitDepth > MAX_UINT16) {
            console.warn('[fileIOUtils] Invalid bitDepth for WAV header, defaulting:', bitDepth);
            safeBitDepth = DEFAULT_WAV_BIT_DEPTH;
        }
        safeBitDepth = Math.floor(safeBitDepth);

        let safeAudioFormat = Number(audioFormat);
        if (!Number.isFinite(safeAudioFormat) || safeAudioFormat <= 0 || safeAudioFormat > MAX_UINT16) {
            console.warn('[fileIOUtils] Invalid audioFormat for WAV header, defaulting:', audioFormat);
            safeAudioFormat = DEFAULT_WAV_AUDIO_FORMAT;
        }
        safeAudioFormat = Math.floor(safeAudioFormat);

        const bytesPerSample = safeBitDepth / 8;
        let byteRate = safeSampleRate * safeChannels * bytesPerSample;
        if (!Number.isFinite(byteRate) || byteRate <= 0 || byteRate > MAX_UINT32) {
            console.warn('[fileIOUtils] Invalid byteRate for WAV header, defaulting:', byteRate);
            byteRate = DEFAULT_WAV_SAMPLE_RATE * DEFAULT_WAV_CHANNELS * (DEFAULT_WAV_BIT_DEPTH / 8);
        }
        byteRate = Math.min(Math.floor(byteRate), MAX_UINT32);

        let blockAlign = safeChannels * bytesPerSample;
        if (!Number.isFinite(blockAlign) || blockAlign <= 0 || blockAlign > MAX_UINT16) {
            console.warn('[fileIOUtils] Invalid blockAlign for WAV header, defaulting:', blockAlign);
            blockAlign = DEFAULT_WAV_CHANNELS * (DEFAULT_WAV_BIT_DEPTH / 8);
        }
        blockAlign = Math.min(Math.floor(blockAlign), MAX_UINT16);

        const buffer = Buffer.alloc(44);
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + dataSize, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(safeAudioFormat, 20); // 7 = mu-law, 1 = PCM
        buffer.writeUInt16LE(safeChannels, 22);
        buffer.writeUInt32LE(safeSampleRate, 24);
        buffer.writeUInt32LE(byteRate, 28);
        buffer.writeUInt16LE(blockAlign, 32);
        buffer.writeUInt16LE(safeBitDepth, 34); // 8-bit samples for mu-law
        buffer.write('data', 36);
        buffer.writeUInt32LE(dataSize, 40);
        return buffer;
    } catch (err) {
        console.warn('[fileIOUtils] writeWavHeader failed, returning empty header:', err?.message || err);
        try {
            const buffer = Buffer.alloc(44);
            buffer.write('RIFF', 0);
            buffer.writeUInt32LE(36, 4);
            buffer.write('WAVE', 8);
            buffer.write('fmt ', 12);
            buffer.writeUInt32LE(16, 16);
            buffer.writeUInt16LE(DEFAULT_WAV_AUDIO_FORMAT, 20);
            buffer.writeUInt16LE(DEFAULT_WAV_CHANNELS, 22);
            buffer.writeUInt32LE(DEFAULT_WAV_SAMPLE_RATE, 24);
            buffer.writeUInt32LE(
                DEFAULT_WAV_SAMPLE_RATE * DEFAULT_WAV_CHANNELS * (DEFAULT_WAV_BIT_DEPTH / 8),
                28
            );
            buffer.writeUInt16LE(DEFAULT_WAV_CHANNELS * (DEFAULT_WAV_BIT_DEPTH / 8), 32);
            buffer.writeUInt16LE(DEFAULT_WAV_BIT_DEPTH, 34);
            buffer.write('data', 36);
            buffer.writeUInt32LE(0, 40);
            return buffer;
        } catch {
            return Buffer.alloc(0);
        }
    }
};
