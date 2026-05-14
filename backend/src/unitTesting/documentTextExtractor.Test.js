// HOW TO RUN:
//   node backend/src/unitTesting/documentTextExtractor.Test.js
//   node backend/src/unitTesting/documentTextExtractor.Test.js --pdf=path/to/input.pdf
//
// This test script runs a mocked version of documentTextExtractor.js
// and covers:
// - Success + failure paths
// - All 5 fallbacks (Steps 1-5)
// - API key success and failure
// - Input as a PDF file

import fs from "fs";
import path from "path";
import os from "os";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { fileURLToPath, pathToFileURL } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, "..");
const utilsDir = path.join(srcDir, "utils");
const docPath = path.join(utilsDir, "documentTextExtractor.js");

const tmpMediaDir = path.join(os.tmpdir(), "AiSelektTmpMedia");
if (!fs.existsSync(tmpMediaDir)) {
  fs.mkdirSync(tmpMediaDir, { recursive: true });
}

function readArgValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const pdfArg = readArgValue("--pdf=") || process.env.TEST_PDF_PATH || null;
const defaultPdfPath = path.join(tmpMediaDir, "unit_test_input.pdf");

if (!pdfArg && !fs.existsSync(defaultPdfPath)) {
  // Minimal placeholder PDF content (does not need to be valid for mocked tests)
  const minimalPdf = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n";
  fs.writeFileSync(defaultPdfPath, minimalPdf);
}

const inputPdfPath = pdfArg || defaultPdfPath;
const inputPdfBuffer = fs.readFileSync(inputPdfPath);

console.log("[TEST] Input PDF:", inputPdfPath, "(bytes:", inputPdfBuffer.length, ")");

// -------------------------------
// Mock state + helpers
// -------------------------------
const mockState = {
  extractPdfTextImpl: async () => "",
  extractWordTextImpl: async () => ({ ok: false, text: "" }),
  smartFallbackImpl: async () => {
    throw new Error("Smart fallback disabled");
  },
  loadKeysConfigFromDBImpl: async () => null,
  ilove: {
    extractResponses: [],
    officeResponse: Buffer.from(""),
    throwOnExtract: false,
    throwOnOffice: false,
  },
  iloveInitCount: 0,
  iloveNewTaskCalls: [],
};

globalThis.__DOC_TEST_STATE = mockState;

function resetMockState() {
  mockState.extractPdfTextImpl = async () => "";
  mockState.extractWordTextImpl = async () => ({ ok: false, text: "" });
  mockState.smartFallbackImpl = async () => {
    throw new Error("Smart fallback disabled");
  };
  mockState.loadKeysConfigFromDBImpl = async () => null;
  mockState.ilove.extractResponses = [];
  mockState.ilove.officeResponse = Buffer.from("");
  mockState.ilove.throwOnExtract = false;
  mockState.ilove.throwOnOffice = false;
  mockState.iloveInitCount = 0;
  mockState.iloveNewTaskCalls = [];
}

// -------------------------------
// Write mocks + patched module
// -------------------------------
const testDir = path.join(tmpMediaDir, `docTextExtractor_test_${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

const mockDotenvPath = path.join(testDir, "mock_dotenv.js");
const mockILovePdfPath = path.join(testDir, "mock_ilovepdf.js");
const mockILovePdfFilePath = path.join(testDir, "mock_ilovepdf_file.js");
const mockPdfExtractorPath = path.join(testDir, "mock_pdfTextExtracter.js");
const mockWordExtractorPath = path.join(testDir, "mock_wordTextExtracter.js");
const mockImageExtractorPath = path.join(testDir, "mock_imageExtractor.js");
const mockDbUtilsPath = path.join(testDir, "mock_dbUtils.js");

fs.writeFileSync(mockDotenvPath, `
export default {
  config() {
    return { parsed: {} };
  }
}
`.trim());

fs.writeFileSync(mockILovePdfPath, `
const state = globalThis.__DOC_TEST_STATE;

class MockILovePDFTask {
  constructor(kind) { this.kind = kind; }
  async start() { return true; }
  async addFile() { return true; }
  async process() { return true; }
  async download() {
    if (this.kind === "extract") {
      if (state.ilove.throwOnExtract) throw new Error("ILovePDF extract failed");
      const next = state.ilove.extractResponses.shift() || "";
      return Buffer.from(next, "utf8");
    }
    if (this.kind === "officepdf") {
      if (state.ilove.throwOnOffice) throw new Error("ILovePDF officepdf failed");
      return state.ilove.officeResponse || Buffer.from("");
    }
    return Buffer.from("");
  }
}

export default class MockILovePDFApi {
  constructor(publicKey, secretKey) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
    state.iloveInitCount += 1;
  }
  newTask(kind) {
    state.iloveNewTaskCalls.push(kind);
    return new MockILovePDFTask(kind);
  }
}
`.trim());

fs.writeFileSync(mockILovePdfFilePath, `
export default class MockILovePDFFile {
  constructor(file) { this.file = file; }
}
`.trim());

fs.writeFileSync(mockPdfExtractorPath, `
const state = globalThis.__DOC_TEST_STATE;
export async function extractPdfText(...args) { return state.extractPdfTextImpl(...args); }
`.trim());

fs.writeFileSync(mockWordExtractorPath, `
const state = globalThis.__DOC_TEST_STATE;
export async function extractWordText(...args) { return state.extractWordTextImpl(...args); }
`.trim());

fs.writeFileSync(mockImageExtractorPath, `
const state = globalThis.__DOC_TEST_STATE;
export async function processDocumentWithSmartFallback(...args) { return state.smartFallbackImpl(...args); }
`.trim());

fs.writeFileSync(mockDbUtilsPath, `
const state = globalThis.__DOC_TEST_STATE;
export async function loadKeysConfigFromDB(...args) { return state.loadKeysConfigFromDBImpl(...args); }
`.trim());

const originalDoc = fs.readFileSync(docPath, "utf8");
let patchedDoc = originalDoc
  .replace(/from\s+["']dotenv["'];/g, 'from "./mock_dotenv.js";')
  .replace(/from\s+["']@ilovepdf\/ilovepdf-nodejs["'];/g, 'from "./mock_ilovepdf.js";')
  .replace(/from\s+["']@ilovepdf\/ilovepdf-nodejs\/ILovePDFFile\.js["'];/g, 'from "./mock_ilovepdf_file.js";')
  .replace(/from\s+["']\.\/extractors\/pdfTextExtracter\.js["'];/g, 'from "./mock_pdfTextExtracter.js";')
  .replace(/from\s+["']\.\/extractors\/wordTextExtracter\.js["'];/g, 'from "./mock_wordTextExtracter.js";')
  .replace(/from\s+["']\.\/extractors\/imageExtractor\.js["'];/g, 'from "./mock_imageExtractor.js";')
  .replace(/from\s+["']\.\/dbUtils\.js["'];/g, 'from "./mock_dbUtils.js";');

const patchedDocPath = path.join(testDir, "documentTextExtractor.patched.js");
fs.writeFileSync(patchedDocPath, patchedDoc);

const { extractResumeText } = await import(pathToFileURL(patchedDocPath).href + `?v=${Date.now()}`);

// -------------------------------
// Test runner
// -------------------------------
let PASS = 0;
let FAIL = 0;

async function runTest(name, fn) {
  console.log("\n[TEST]", name);
  try {
    await fn();
    PASS += 1;
    console.log("[PASS]", name);
  } catch (err) {
    FAIL += 1;
    console.error("[FAIL]", name);
    console.error("       ", err?.message || err);
  }
}

// -------------------------------
// Tests
// -------------------------------
const originalEnv = {
  ILOVEPDF_PUBLIC_KEY: process.env.ILOVEPDF_PUBLIC_KEY,
  ILOVEPDF_SECRET_KEY: process.env.ILOVEPDF_SECRET_KEY,
};

await runTest("Step 1 local extraction success (PDF)", async () => {
  resetMockState();
  mockState.extractPdfTextImpl = async () => "LOCAL_TEXT_" + "x".repeat(120);

  const [text, outPath] = await extractResumeText(inputPdfBuffer, "sample.pdf", {});

  assert.ok(text.includes("LOCAL_TEXT_"), "Expected local text");
  assert.ok(outPath.includes("tmpResume_"), "Expected temp file path");
});

await runTest("Step 2 remote extraction success", async () => {
  resetMockState();
  mockState.extractPdfTextImpl = async () => "short"; // insufficient
  mockState.loadKeysConfigFromDBImpl = async () => ({
    configurationDetails: { apiKey: "dbKey", secretKey: "dbSecret" },
  });
  mockState.ilove.extractResponses = ["REMOTE_STEP2_" + "y".repeat(80)];

  const [text] = await extractResumeText(inputPdfBuffer, "sample.pdf", {});
  assert.ok(text.includes("REMOTE_STEP2_"), "Expected Step 2 text");
  assert.equal(mockState.iloveNewTaskCalls.filter((k) => k === "extract").length, 1);
});

await runTest("Step 3 remote retry success", async () => {
  resetMockState();
  mockState.extractPdfTextImpl = async () => "short";
  mockState.loadKeysConfigFromDBImpl = async () => ({
    configurationDetails: { apiKey: "dbKey", secretKey: "dbSecret" },
  });
  mockState.ilove.extractResponses = ["tiny", "REMOTE_STEP3_" + "z".repeat(80)];

  const [text] = await extractResumeText(inputPdfBuffer, "sample.pdf", {});
  assert.ok(text.includes("REMOTE_STEP3_"), "Expected Step 3 text");
  assert.equal(mockState.iloveNewTaskCalls.filter((k) => k === "extract").length, 2);
});

await runTest("Step 4 DOCX extraction success", async () => {
  resetMockState();
  mockState.extractWordTextImpl = async () => ({ ok: true, text: "DOCX_TEXT_" + "d".repeat(80) });

  const [text] = await extractResumeText(inputPdfBuffer, "sample.docx", {});
  assert.ok(text.includes("DOCX_TEXT_"), "Expected DOCX text");
});

await runTest("Smart fallback success", async () => {
  resetMockState();
  mockState.extractPdfTextImpl = async () => {
    throw new Error("local extract fail");
  };
  mockState.smartFallbackImpl = async () => ["SMART_FALLBACK_TEXT", "dummy-path"];

  const [text] = await extractResumeText(inputPdfBuffer, "sample.pdf", {});
  assert.equal(text, "SMART_FALLBACK_TEXT");
});

await runTest("Step 5 Office->PDF fallback success", async () => {
  resetMockState();
  mockState.extractWordTextImpl = async () => ({ ok: false, text: "" });
  mockState.smartFallbackImpl = async () => {
    throw new Error("no smart fallback");
  };
  mockState.loadKeysConfigFromDBImpl = async () => ({
    configurationDetails: { apiKey: "dbKey", secretKey: "dbSecret" },
  });
  mockState.ilove.officeResponse = Buffer.from("PDF_BUFFER");
  mockState.extractPdfTextImpl = async () => "RECURSIVE_PDF_TEXT_" + "p".repeat(150);

  const [text] = await extractResumeText(inputPdfBuffer, "sample.doc", {});
  assert.ok(text.includes("RECURSIVE_PDF_TEXT_"), "Expected Step 5 recursive text");
  assert.ok(mockState.iloveNewTaskCalls.includes("officepdf"), "Expected officepdf task");
});

await runTest("API key success from DB", async () => {
  resetMockState();
  mockState.loadKeysConfigFromDBImpl = async () => ({
    configurationDetails: { apiKey: "dbKey", secretKey: "dbSecret" },
  });
  mockState.extractPdfTextImpl = async () => "LOCAL_TEXT_" + "x".repeat(120);

  await extractResumeText(inputPdfBuffer, "sample.pdf", {});
  assert.equal(mockState.iloveInitCount, 1, "Expected ILovePDF init from DB keys");
});

await runTest("API key success from ENV", async () => {
  resetMockState();
  process.env.ILOVEPDF_PUBLIC_KEY = "ENV_PUBLIC";
  process.env.ILOVEPDF_SECRET_KEY = "ENV_SECRET";
  mockState.loadKeysConfigFromDBImpl = async () => null;
  mockState.extractPdfTextImpl = async () => "LOCAL_TEXT_" + "x".repeat(120);

  await extractResumeText(inputPdfBuffer, "sample.pdf", {});
  assert.equal(mockState.iloveInitCount, 1, "Expected ILovePDF init from ENV keys");
});

await runTest("API key failure path", async () => {
  resetMockState();
  delete process.env.ILOVEPDF_PUBLIC_KEY;
  delete process.env.ILOVEPDF_SECRET_KEY;
  mockState.loadKeysConfigFromDBImpl = async () => {
    throw new Error("DB down");
  };
  mockState.extractPdfTextImpl = async () => {
    throw new Error("local extract fail");
  };
  mockState.smartFallbackImpl = async () => {
    throw new Error("no smart fallback");
  };

  const [text] = await extractResumeText(inputPdfBuffer, "sample.pdf", {});
  assert.equal(text, "", "Expected empty result when keys missing and all fallbacks fail");
  assert.equal(mockState.iloveInitCount, 0, "Expected no ILovePDF init");
});

await runTest("Failure: invalid fileBuffer string", async () => {
  resetMockState();
  const [text, p] = await extractResumeText("not-a-buffer", "sample.pdf", {});
  assert.equal(text, "");
  assert.equal(p, "");
});

// Restore env
process.env.ILOVEPDF_PUBLIC_KEY = originalEnv.ILOVEPDF_PUBLIC_KEY;
process.env.ILOVEPDF_SECRET_KEY = originalEnv.ILOVEPDF_SECRET_KEY;

console.log("\n[RESULT] Passed:", PASS, "Failed:", FAIL);
process.exit(FAIL ? 1 : 0);

