// HOW TO RUN:
//   node backend/src/unitTesting/pdfTextExtracter.Test.js
//
// Tests for backend/src/utils/extractors/pdfTextExtracter.js
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
const targetPath = path.join(utilsDir, 'pdfTextExtracter.js');

const tmpMediaDir = path.join(os.tmpdir(), 'AiSelektTmpMedia');
if (!fs.existsSync(tmpMediaDir)) {
  fs.mkdirSync(tmpMediaDir, { recursive: true });
}

// -------------------------------
// Mock state
// -------------------------------
const state = {
  pdfjs: {
    throwOnExtract: false,
    pages: [{ content: [{ str: 'Hello' }] }],
  },
  poppler: {
    throwOnText: false,
    text: 'Poppler text',
  },
  pdfreader: {
    throwOnParse: false,
    items: ['R1', 'R2'],
  },
};

globalThis.__PDF_TEST_STATE = state;

function resetState() {
  state.pdfjs.throwOnExtract = false;
  state.pdfjs.pages = [{ content: [{ str: 'Hello' }] }];
  state.poppler.throwOnText = false;
  state.poppler.text = 'Poppler text';
  state.pdfreader.throwOnParse = false;
  state.pdfreader.items = ['R1', 'R2'];
}

// -------------------------------
// Write mocks + patched module
// -------------------------------
const testDir = path.join(tmpMediaDir, `pdfTextExtractor_test_${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

const mockPdfJsPath = path.join(testDir, 'mock_pdfjs.js');
const mockPopplerPath = path.join(testDir, 'mock_poppler.js');
const mockPdfReaderPath = path.join(testDir, 'mock_pdfreader.js');
const mockServerPath = path.join(testDir, 'mock_server.js');

fs.writeFileSync(mockPdfJsPath, `
const state = globalThis.__PDF_TEST_STATE;

export class PDFExtract {
  extract(filePath, opts, cb) {
    if (state.pdfjs.throwOnExtract) {
      cb(new Error('pdf.js-extract failed'));
      return;
    }
    cb(null, { pages: state.pdfjs.pages });
  }
}
`.trim());

fs.writeFileSync(mockPopplerPath, `
import fs from 'fs';
const state = globalThis.__PDF_TEST_STATE;

export class Poppler {
  async pdfToText(input, output) {
    if (state.poppler.throwOnText) throw new Error('poppler failed');
    fs.writeFileSync(output, state.poppler.text || '');
  }
}
`.trim());

fs.writeFileSync(mockPdfReaderPath, `
const state = globalThis.__PDF_TEST_STATE;

export class PdfReader {
  parseFileItems(filePath, cb) {
    if (state.pdfreader.throwOnParse) {
      cb(new Error('pdfreader failed'));
      return;
    }
    for (const item of state.pdfreader.items) {
      cb(null, { str: item });
    }
    cb(null, null);
  }
}
`.trim());

fs.writeFileSync(mockServerPath, `
import fs from 'fs';
import path from 'path';
import os from 'os';

export const tmpMediaDir = path.join(os.tmpdir(), 'AiSelektTmpMedia');
if (!fs.existsSync(tmpMediaDir)) {
  fs.mkdirSync(tmpMediaDir, { recursive: true });
}
`.trim());

const original = fs.readFileSync(targetPath, 'utf8');
const patched = original
  .replace(/from\s+['"]pdf\.js-extract['"];?/g, 'from "./mock_pdfjs.js";')
  .replace(/from\s+['"]node-poppler['"];?/g, 'from "./mock_poppler.js";')
  .replace(/from\s+['"]pdfreader['"];?/g, 'from "./mock_pdfreader.js";')
  .replace(/from\s+['"]\.\.\/\.\.\/\.\.\/server\.js['"];?/g, 'from "./mock_server.js";');

const patchedPath = path.join(testDir, 'pdfTextExtracter.patched.js');
fs.writeFileSync(patchedPath, patched);

const { extractPdfText } = await import(pathToFileURL(patchedPath).href + `?v=${Date.now()}`);

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
// Tests
// -------------------------------
await runTest('Success: pdf.js-extract returns text', async () => {
  resetState();
  state.pdfjs.pages = [{ content: [{ str: 'PDFJS_OK' }] }];
  const txt = await extractPdfText(Buffer.from('pdf'), 'ok.pdf');
  assert.ok(txt.includes('PDFJS_OK'));
});

await runTest('Fallback: pdf.js-extract empty -> poppler succeeds', async () => {
  resetState();
  state.pdfjs.pages = [{ content: [] }];
  state.poppler.text = 'POPPLER_OK';
  const txt = await extractPdfText(Buffer.from('pdf'), 'ok.pdf');
  assert.ok(txt.includes('POPPLER_OK'));
});

await runTest('Fallback: pdf.js-extract and poppler empty -> pdfreader succeeds', async () => {
  resetState();
  state.pdfjs.pages = [{ content: [] }];
  state.poppler.text = '';
  state.pdfreader.items = ['READER_OK'];
  const txt = await extractPdfText(Buffer.from('pdf'), 'ok.pdf');
  assert.ok(txt.includes('READER_OK'));
});

await runTest('Failure: all extractors empty', async () => {
  resetState();
  state.pdfjs.pages = [{ content: [] }];
  state.poppler.text = '';
  state.pdfreader.items = [];
  let failed = false;
  try {
    await extractPdfText(Buffer.from('pdf'), 'ok.pdf');
  } catch (err) {
    failed = true;
    assert.ok(String(err?.message || err).includes('All local extraction methods failed'));
  }
  assert.ok(failed, 'expected failure');
});

await runTest('Failure: invalid buffer input', async () => {
  let failed = false;
  try {
    await extractPdfText(123, 'ok.pdf');
  } catch (err) {
    failed = true;
    assert.ok(String(err?.message || err).includes('Invalid PDF buffer'));
  }
  assert.ok(failed, 'expected invalid buffer failure');
});

await runTest('Failure: missing buffer', async () => {
  let failed = false;
  try {
    await extractPdfText(null, 'ok.pdf');
  } catch (err) {
    failed = true;
    assert.ok(String(err?.message || err).includes('PDF buffer is required'));
  }
  assert.ok(failed, 'expected missing buffer failure');
});

await runTest('Failure: temp file write error', async () => {
  resetState();
  let failed = false;
  const originalWrite = fs.writeFileSync;
  try {
    fs.writeFileSync = () => { throw new Error('disk full'); };
    await extractPdfText(Buffer.from('pdf'), 'ok.pdf');
  } catch (err) {
    failed = true;
    assert.ok(String(err?.message || err).includes('disk full'));
  } finally {
    fs.writeFileSync = originalWrite;
  }
  assert.ok(failed, 'expected write failure');
});

console.log(`\n[RESULT] Passed: ${PASS}, Failed: ${FAIL}`);
process.exit(FAIL ? 1 : 0);

