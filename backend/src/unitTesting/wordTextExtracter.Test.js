// HOW TO RUN:
//   node backend/src/unitTesting/wordTextExtracter.Test.js
//
// Tests for backend/src/utils/extractors/wordTextExtracter.js
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
const targetPath = path.join(utilsDir, 'wordTextExtracter.js');

const tmpMediaDir = path.join(os.tmpdir(), 'AiSelektTmpMedia');
if (!fs.existsSync(tmpMediaDir)) {
  fs.mkdirSync(tmpMediaDir, { recursive: true });
}

// -------------------------------
// Mock state
// -------------------------------
const state = {
  mammoth: {
    throwOnExtract: false,
    text: 'MAMMOTH_OK',
  },
  office: {
    throwOnExtract: false,
    text: 'OFFICE_OK',
  },
  word: {
    throwOnExtract: false,
    text: 'WORD_OK',
  },
  anytext: {
    throwOnGetText: false,
    text: 'ANYTEXT_OK',
  },
};

globalThis.__WORD_TEST_STATE = state;

function resetState() {
  state.mammoth.throwOnExtract = false;
  state.mammoth.text = 'MAMMOTH_OK';
  state.office.throwOnExtract = false;
  state.office.text = 'OFFICE_OK';
  state.word.throwOnExtract = false;
  state.word.text = 'WORD_OK';
  state.anytext.throwOnGetText = false;
  state.anytext.text = 'ANYTEXT_OK';
}

// -------------------------------
// Write mocks + patched module
// -------------------------------
const testDir = path.join(tmpMediaDir, `wordTextExtractor_test_${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

const mockMammothPath = path.join(testDir, 'mock_mammoth.js');
const mockWordExtractorPath = path.join(testDir, 'mock_word_extractor.js');
const mockOfficePath = path.join(testDir, 'mock_office.js');
const mockAnyTextPath = path.join(testDir, 'mock_anytext.js');

fs.writeFileSync(mockMammothPath, `
const state = globalThis.__WORD_TEST_STATE;
export default {
  async extractRawText() {
    if (state.mammoth.throwOnExtract) throw new Error('mammoth failed');
    return { value: state.mammoth.text };
  }
};
`.trim());

fs.writeFileSync(mockWordExtractorPath, `
const state = globalThis.__WORD_TEST_STATE;
export default class WordExtractor {
  async extract() {
    if (state.word.throwOnExtract) throw new Error('word-extractor failed');
    return {
      getBody() {
        return state.word.text;
      }
    };
  }
}
`.trim());

fs.writeFileSync(mockOfficePath, `
const state = globalThis.__WORD_TEST_STATE;
export default async function officeExtract() {
  if (state.office.throwOnExtract) throw new Error('office-text-extractor failed');
  return state.office.text;
}
`.trim());

fs.writeFileSync(mockAnyTextPath, `
const state = globalThis.__WORD_TEST_STATE;
export default {
  getText(file, cb) {
    if (state.anytext.throwOnGetText) {
      cb(new Error('any-text failed'));
      return;
    }
    cb(null, state.anytext.text);
  }
};
`.trim());

const original = fs.readFileSync(targetPath, 'utf8');
const patched = original
  .replace(/from\s+['"]mammoth['"];?/g, 'from "./mock_mammoth.js";')
  .replace(/from\s+['"]word-extractor['"];?/g, 'from "./mock_word_extractor.js";')
  .replace(/import\s+\*\s+as\s+officeExtract\s+from\s+['"]office-text-extractor['"];?/g, 'import officeExtract from "./mock_office.js";')
  .replace(/from\s+['"]any-text['"];?/g, 'from "./mock_anytext.js";');

const patchedPath = path.join(testDir, 'wordTextExtracter.patched.js');
fs.writeFileSync(patchedPath, patched);

const { extractWordText } = await import(pathToFileURL(patchedPath).href + `?v=${Date.now()}`);

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
const sampleDocx = path.join(testDir, 'sample.docx');
const sampleDocValid = path.join(testDir, 'sample-valid.doc');
const sampleDocInvalid = path.join(testDir, 'sample-invalid.doc');

fs.writeFileSync(sampleDocx, 'DOCX');
// Valid OLE header: D0 CF 11 E0
fs.writeFileSync(sampleDocValid, Buffer.from('D0CF11E000000000', 'hex'));
fs.writeFileSync(sampleDocInvalid, 'NOT_OLE');

// -------------------------------
// Tests
// -------------------------------
await runTest('Success: DOCX via mammoth', async () => {
  resetState();
  const res = await extractWordText(Buffer.from('x'), 'file.docx');
  assert.equal(res.ok, true);
  assert.ok(res.text.includes('MAMMOTH_OK'));
  assert.equal(res.src, 'mammoth');
});

await runTest('Fallback: mammoth fail -> office-text-extractor', async () => {
  resetState();
  state.mammoth.throwOnExtract = true;
  const res = await extractWordText(Buffer.from('x'), 'file.docx');
  assert.equal(res.ok, true);
  assert.ok(res.text.includes('OFFICE_OK'));
  assert.equal(res.src, 'office-text-extractor');
});

await runTest('Success: DOC via word-extractor', async () => {
  resetState();
  const res = await extractWordText(sampleDocValid, 'file.doc');
  assert.equal(res.ok, true);
  assert.ok(res.text.includes('WORD_OK'));
  assert.equal(res.src, 'word-extractor');
});

await runTest('Fallback: DOCX any-text success', async () => {
  resetState();
  state.mammoth.throwOnExtract = true;
  state.office.throwOnExtract = true;
  const res = await extractWordText(Buffer.from('x'), 'file.docx');
  assert.equal(res.ok, true);
  assert.ok(res.text.includes('ANYTEXT_OK'));
  assert.equal(res.src, 'any-text');
});

await runTest('Failure: DOC invalid OLE -> any-text blocked', async () => {
  resetState();
  state.word.throwOnExtract = true;
  const res = await extractWordText(sampleDocInvalid, 'file.doc');
  assert.equal(res.ok, false);
  assert.ok(res.error, 'expected error');
});

await runTest('Failure: any-text throws', async () => {
  resetState();
  state.mammoth.throwOnExtract = true;
  state.office.throwOnExtract = true;
  state.anytext.throwOnGetText = true;
  const res = await extractWordText(Buffer.from('x'), 'file.docx');
  assert.equal(res.ok, false);
  assert.ok(res.error, 'expected error');
});

await runTest('Failure: missing input', async () => {
  const res = await extractWordText(null, 'file.docx');
  assert.equal(res.ok, false);
  assert.ok(res.error, 'expected error');
});

await runTest('Failure: invalid input type', async () => {
  const res = await extractWordText(123, 'file.docx');
  assert.equal(res.ok, false);
  assert.ok(res.error, 'expected error');
});

await runTest('Failure: temp file write error', async () => {
  resetState();
  let failed = false;
  const originalWrite = fs.promises.writeFile;
  try {
    fs.promises.writeFile = async () => { throw new Error('disk full'); };
    const res = await extractWordText(Buffer.from('x'), 'file.docx');
    failed = !res.ok;
  } finally {
    fs.promises.writeFile = originalWrite;
  }
  assert.ok(failed, 'expected write failure');
});

console.log(`\n[RESULT] Passed: ${PASS}, Failed: ${FAIL}`);
process.exit(FAIL ? 1 : 0);
