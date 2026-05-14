// HOW TO RUN:
//   node backend/src/unitTesting/imageExtractor.Test.js
//
// Tests for backend/src/utils/extractors/imageExtractor.js
// Covers success + failure paths and logs results.

import fs from 'fs';
import path from 'path';
import os from 'os';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '..');
const utilsDir = path.join(srcDir, 'utils', 'extractors');
const targetPath = path.join(utilsDir, 'imageExtractor.js');

const tmpMediaDir = path.join(os.tmpdir(), 'AiSelektTmpMedia');
if (!fs.existsSync(tmpMediaDir)) {
  fs.mkdirSync(tmpMediaDir, { recursive: true });
}

// -------------------------------
// Mock state
// -------------------------------
const state = {
  poppler: {
    throwOnPdfToCairo: false,
    throwOnPdfImages: false,
    images: 1,
    embeddedImages: 1,
  },
  mammoth: {
    throwOnConvert: false,
    imageCount: 1,
  },
  tesseract: {
    throwOnCreate: false,
    throwOnRecognize: false,
    texts: [],
    terminated: false,
  },
  gemini: {
    throwOnCall: false,
    text: '',
  },
};

globalThis.__IMG_TEST_STATE = state;

function resetState() {
  state.poppler.throwOnPdfToCairo = false;
  state.poppler.throwOnPdfImages = false;
  state.poppler.images = 1;
  state.poppler.embeddedImages = 1;
  state.mammoth.throwOnConvert = false;
  state.mammoth.imageCount = 1;
  state.tesseract.throwOnCreate = false;
  state.tesseract.throwOnRecognize = false;
  state.tesseract.texts = [];
  state.tesseract.terminated = false;
  state.gemini.throwOnCall = false;
  state.gemini.text = '';
}

// -------------------------------
// Write mocks + patched module
// -------------------------------
const testDir = path.join(tmpMediaDir, `imageExtractor_test_${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

const mockPopplerPath = path.join(testDir, 'mock_poppler.js');
const mockMammothPath = path.join(testDir, 'mock_mammoth.js');
const mockTesseractPath = path.join(testDir, 'mock_tesseract.js');
const mockGeminiPath = path.join(testDir, 'mock_gemini.js');

fs.writeFileSync(mockPopplerPath, `
import fs from 'fs';
import path from 'path';
const state = globalThis.__IMG_TEST_STATE;

export class Poppler {
  async pdfToCairo(filePath, outputPrefix) {
    if (state.poppler.throwOnPdfToCairo) throw new Error('pdfToCairo failed');
    const dir = path.dirname(outputPrefix);
    const base = path.basename(outputPrefix);
    const count = state.poppler.images || 0;
    for (let i = 1; i <= count; i += 1) {
      const out = path.join(dir, base + "-" + i + ".png");
      fs.writeFileSync(out, 'img');
    }
  }

  async pdfImages(filePath, outputPrefix) {
    if (state.poppler.throwOnPdfImages) throw new Error('pdfImages failed');
    const dir = path.dirname(outputPrefix);
    const base = path.basename(outputPrefix);
    const count = state.poppler.embeddedImages || 0;
    for (let i = 1; i <= count; i += 1) {
      const out = path.join(dir, base + "-" + i + ".jpg");
      fs.writeFileSync(out, 'img');
    }
  }
}
`.trim());

fs.writeFileSync(mockMammothPath, `
const state = globalThis.__IMG_TEST_STATE;

const mammoth = {
  images: {
    imgElement: (fn) => fn,
  },
  async convertToHtml(opts, { convertImage }) {
    if (state.mammoth.throwOnConvert) throw new Error('mammoth failed');
    const count = state.mammoth.imageCount || 0;
    const base64 = Buffer.from('img').toString('base64');
    const jobs = [];
    for (let i = 0; i < count; i += 1) {
      jobs.push(convertImage({
        contentType: 'image/png',
        read: async () => base64,
      }));
    }
    await Promise.all(jobs);
    return { value: '' };
  }
};

export default mammoth;
`.trim());

fs.writeFileSync(mockTesseractPath, `
const state = globalThis.__IMG_TEST_STATE;

const Tesseract = {
  async createWorker() {
    if (state.tesseract.throwOnCreate) throw new Error('tesseract init failed');
    return {
      recognize: async () => {
        if (state.tesseract.throwOnRecognize) throw new Error('tesseract recognize failed');
        const text = state.tesseract.texts.shift() || '';
        return { data: { text } };
      },
      terminate: async () => {
        state.tesseract.terminated = true;
      }
    };
  }
};

export default Tesseract;
`.trim());

fs.writeFileSync(mockGeminiPath, `
const state = globalThis.__IMG_TEST_STATE;

export async function geminiChatCompletion() {
  if (state.gemini.throwOnCall) throw new Error('gemini failed');
  return { choices: [{ message: { content: state.gemini.text } }] };
}
`.trim());

const original = fs.readFileSync(targetPath, 'utf8');
const patched = original
  .replace(/from\s+['"]node-poppler['"];?/g, 'from "./mock_poppler.js";')
  .replace(/from\s+['"]mammoth['"];?/g, 'from "./mock_mammoth.js";')
  .replace(/from\s+['"]tesseract\.js['"];?/g, 'from "./mock_tesseract.js";')
  .replace(/from\s+['"]\.\.\/aiGeminiCompletions\.js['"];?/g, 'from "./mock_gemini.js";');

const patchedPath = path.join(testDir, 'imageExtractor.patched.js');
fs.writeFileSync(patchedPath, patched);

const imageMod = await import(pathToFileURL(patchedPath).href + `?v=${Date.now()}`);

const {
  extractImagesFromPdf,
  extractImagesFromDocx,
  extractImages,
  processDocumentWithSmartFallback,
} = imageMod;

// -------------------------------
// Test runner
// -------------------------------
let PASS = 0;
let FAIL = 0;

async function runTest(name, fn) {
  console.log(`\n[TEST] ${name}`);
  try {
    await fn();
    PASS += 1;
    console.log(`[SUCCESS] ${name}`);
  } catch (err) {
    FAIL += 1;
    const msg = err?.message || err;
    console.error(`[FAILURE] ${name}`);
    console.error(`[ERROR] ${msg}`);
  }
}

// -------------------------------
// Test files
// -------------------------------
const samplePdf = path.join(testDir, 'sample.pdf');
const sampleDocx = path.join(testDir, 'sample.docx');
fs.writeFileSync(samplePdf, '%PDF-1.4\n%EOF\n');
fs.writeFileSync(sampleDocx, 'DOCX');

// -------------------------------
// Tests
// -------------------------------
await runTest('extractImagesFromPdf success', async () => {
  resetState();
  state.poppler.images = 2;
  const images = await extractImagesFromPdf(samplePdf);
  assert.equal(images.length, 2, 'expected 2 images');
  images.forEach((p) => assert.ok(fs.existsSync(p), `missing ${p}`));
});

await runTest('extractImagesFromPdf failure', async () => {
  resetState();
  state.poppler.throwOnPdfToCairo = true;
  state.poppler.throwOnPdfImages = true;
  const images = await extractImagesFromPdf(samplePdf);
  assert.equal(images.length, 0, 'expected 0 images');
});

await runTest('extractImagesFromDocx success', async () => {
  resetState();
  state.mammoth.imageCount = 3;
  const images = await extractImagesFromDocx(sampleDocx);
  assert.equal(images.length, 3, 'expected 3 images');
  images.forEach((p) => assert.ok(fs.existsSync(p), `missing ${p}`));
});

await runTest('extractImagesFromDocx failure', async () => {
  resetState();
  state.mammoth.throwOnConvert = true;
  const images = await extractImagesFromDocx(sampleDocx);
  assert.equal(images.length, 0, 'expected 0 images');
});

await runTest('extractImages wrapper for .doc returns []', async () => {
  resetState();
  const images = await extractImages(path.join(testDir, 'sample.doc'));
  assert.equal(images.length, 0, 'expected 0 images');
});

await runTest('SmartFallback Step1 (local OCR) success', async () => {
  resetState();
  state.poppler.images = 1;
  state.tesseract.texts = ['X'.repeat(80)];
  const [text] = await processDocumentWithSmartFallback(samplePdf, Buffer.from('pdf'), {});
  assert.ok(text.length > 50, 'expected OCR text length > 50');
});

await runTest('SmartFallback Step2 (Gemini Vision) success', async () => {
  resetState();
  state.poppler.images = 1;
  state.tesseract.texts = ['short'];
  state.gemini.text = 'G'.repeat(80);
  const [text] = await processDocumentWithSmartFallback(samplePdf, Buffer.from('pdf'), {});
  assert.ok(text.startsWith('G'), 'expected Gemini text');
});

await runTest('SmartFallback Step3 (Full Doc) success', async () => {
  resetState();
  state.poppler.throwOnPdfToCairo = true;
  state.poppler.throwOnPdfImages = true;
  state.gemini.text = 'H'.repeat(30);
  const [text] = await processDocumentWithSmartFallback(samplePdf, Buffer.from('pdf'), {});
  assert.ok(text.startsWith('H'), 'expected Full Doc Gemini text');
});

await runTest('SmartFallback invalid file path', async () => {
  resetState();
  const [text] = await processDocumentWithSmartFallback(path.join(testDir, 'missing.pdf'), null, {});
  assert.equal(text, '', 'expected empty text for missing file');
});

console.log(`\n[RESULT] Passed: ${PASS}, Failed: ${FAIL}`);
process.exit(FAIL ? 1 : 0);


