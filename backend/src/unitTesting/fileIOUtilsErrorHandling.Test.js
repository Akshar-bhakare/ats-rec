// HOW TO RUN:
//   node backend/src/unitTesting/fileIOUtils.Test.js
//
// Covers success + error handling paths for:
// - sanitizeFileName
// - writeWavHeader

import path from 'path';
import TestFormatter from '../tests/formatter.js';
import { sanitizeFileName, writeWavHeader } from '../utils/fileIOUtils.js';

const formatter = new TestFormatter();

function captureWarnings(fn) {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => {
        warnings.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    try {
        const result = fn();
        return { result, warnings };
    } finally {
        console.warn = originalWarn;
    }
}

function expectSuccess(name, fn, validate) {
    formatter.testName(name);
    try {
        const { result, warnings } = captureWarnings(fn);
        if (validate) {
            const msg = validate(result, warnings);
            if (msg) {
                formatter.error('Validation failed', new Error(msg));
                return;
            }
        }
        formatter.success('Success');
    } catch (err) {
        formatter.error('Unexpected error', err);
    }
}

function expectWarning(name, fn, expectedSubstring, validate) {
    formatter.testName(name);
    try {
        const { result, warnings } = captureWarnings(fn);
        if (!warnings.some(w => w.includes(expectedSubstring))) {
            formatter.error(
                'Expected warning not found',
                new Error(`Missing warning substring: "${expectedSubstring}"`)
            );
            return;
        }
        if (validate) {
            const msg = validate(result, warnings);
            if (msg) {
                formatter.error('Validation failed', new Error(msg));
                return;
            }
        }
        formatter.success(`Warning captured: ${warnings.find(w => w.includes(expectedSubstring))}`);
    } catch (err) {
        formatter.error('Unexpected error', err);
    }
}

function readHeader(buf) {
    return {
        riff: buf.toString('ascii', 0, 4),
        wave: buf.toString('ascii', 8, 12),
        fmt: buf.toString('ascii', 12, 16),
        data: buf.toString('ascii', 36, 40),
        audioFormat: buf.readUInt16LE(20),
        channels: buf.readUInt16LE(22),
        sampleRate: buf.readUInt32LE(24),
        byteRate: buf.readUInt32LE(28),
        blockAlign: buf.readUInt16LE(32),
        bitDepth: buf.readUInt16LE(34),
        dataSize: buf.readUInt32LE(40),
    };
}

formatter.header('fileIOUtils Error Handling Tests');

// ---------------- sanitizeFileName ----------------

expectSuccess('sanitizeFileName success: normal string', () => {
    return sanitizeFileName('My File?.wav');
}, (result, warnings) => {
    if (warnings.length) return 'Did not expect warnings on success';
    if (typeof result !== 'string') return 'Expected string';
    if (!result.endsWith('.wav')) return 'Expected .wav extension';
    if (result.includes(' ')) return 'Expected spaces to be sanitized';
    return null;
});

expectSuccess('sanitizeFileName error-handled: non-string input', () => {
    return sanitizeFileName(123);
}, (result, warnings) => {
    if (warnings.length) return 'Did not expect warnings for non-string input';
    if (result !== 'unnamed.wav') return `Expected fallback "unnamed.wav", got "${result}"`;
    return null;
});

expectWarning('sanitizeFileName error-handled: internal exception', () => {
    const originalExtname = path.extname;
    try {
        path.extname = () => { throw new Error('boom'); };
        return sanitizeFileName('test.wav');
    } finally {
        path.extname = originalExtname;
    }
}, '[fileIOUtils] sanitizeFileName failed', (result) => {
    if (result !== 'unnamed.wav') return `Expected fallback "unnamed.wav", got "${result}"`;
    return null;
});

// ---------------- writeWavHeader ----------------

expectSuccess('writeWavHeader success: valid params', () => {
    return writeWavHeader(1000, 8000, 1, 8, 7);
}, (result, warnings) => {
    if (warnings.length) return 'Did not expect warnings on success';
    if (!Buffer.isBuffer(result)) return 'Expected Buffer';
    if (result.length !== 44) return `Expected 44-byte header, got ${result.length}`;
    const h = readHeader(result);
    if (h.riff !== 'RIFF' || h.wave !== 'WAVE') return 'Invalid RIFF/WAVE header';
    if (h.dataSize !== 1000) return `Expected dataSize=1000, got ${h.dataSize}`;
    return null;
});

expectWarning('writeWavHeader error-handled: invalid bufferLength', () => {
    return writeWavHeader(-5, 8000, 1, 8, 7);
}, 'Invalid bufferLength', (result) => {
    const h = readHeader(result);
    if (h.dataSize !== 0) return `Expected dataSize=0, got ${h.dataSize}`;
    return null;
});

expectWarning('writeWavHeader error-handled: bufferLength too large', () => {
    return writeWavHeader(Number.MAX_SAFE_INTEGER, 8000, 1, 8, 7);
}, 'bufferLength too large', (result) => {
    const h = readHeader(result);
    const expected = 0xFFFFFFFF - 36;
    if (h.dataSize !== expected) return `Expected dataSize=${expected}, got ${h.dataSize}`;
    return null;
});

expectWarning('writeWavHeader error-handled: invalid sampleRate', () => {
    return writeWavHeader(10, 0, 1, 8, 7);
}, 'Invalid sampleRate', (result) => {
    const h = readHeader(result);
    if (h.sampleRate !== 8000) return `Expected sampleRate=8000, got ${h.sampleRate}`;
    return null;
});

expectWarning('writeWavHeader error-handled: invalid channels', () => {
    return writeWavHeader(10, 8000, 0, 8, 7);
}, 'Invalid channels', (result) => {
    const h = readHeader(result);
    if (h.channels !== 1) return `Expected channels=1, got ${h.channels}`;
    return null;
});

expectWarning('writeWavHeader error-handled: invalid bitDepth', () => {
    return writeWavHeader(10, 8000, 1, 0, 7);
}, 'Invalid bitDepth', (result) => {
    const h = readHeader(result);
    if (h.bitDepth !== 8) return `Expected bitDepth=8, got ${h.bitDepth}`;
    return null;
});

expectWarning('writeWavHeader error-handled: invalid audioFormat', () => {
    return writeWavHeader(10, 8000, 1, 8, 0);
}, 'Invalid audioFormat', (result) => {
    const h = readHeader(result);
    if (h.audioFormat !== 7) return `Expected audioFormat=7, got ${h.audioFormat}`;
    return null;
});

expectWarning('writeWavHeader error-handled: Buffer.alloc throws (fallback header)', () => {
    const originalAlloc = Buffer.alloc;
    let callCount = 0;
    try {
        Buffer.alloc = (...args) => {
            if (callCount === 0) {
                callCount += 1;
                throw new Error('alloc fail');
            }
            return originalAlloc(...args);
        };
        return writeWavHeader(10, 8000, 1, 8, 7);
    } finally {
        Buffer.alloc = originalAlloc;
    }
}, 'writeWavHeader failed', (result) => {
    if (!Buffer.isBuffer(result)) return 'Expected Buffer';
    if (result.length !== 44) return `Expected fallback header length 44, got ${result.length}`;
    return null;
});

formatter.summary();
