// This POC check for:
//Login -->Trigger call --->WS audio Streaming -->STT -->AI-->TTS loop 
//Hangup webhook flow and ATS status  verication 

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function logSection(title) {
  console.log(`\n========== ${title} ==========\n`);
}

function boolFromEnv(name, defaultValue) {
  const raw = (process.env[name] ?? "").toString().trim().toLowerCase();
  if (!raw) return defaultValue;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function numFromEnv(name, defaultValue) {
  const raw = (process.env[name] ?? "").toString().trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function requestJson(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const body = await safeJson(res);
    return { ok: res.ok, status: res.status, body, headers: res.headers };
  } finally {
    clearTimeout(timeout);
  }
}

function ensureSimulationCallUuid(callUuid, enforceSimulation) {
  const base = callUuid && callUuid.trim() ? callUuid.trim() : `call_simulation_poc_${Date.now()}`;
  const finalUuid = base.includes("call_simulation") ? base : `call_simulation_${base}`;
  if (enforceSimulation && !finalUuid.includes("call_simulation")) {
    throw new Error("POC_ENFORCE_SIMULATION=true but call UUID is not a simulation UUID.");
  }
  return finalUuid;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Local credit ledger (soft guard)
const LEDGER_PATH = path.join(__dirname, ".credit-ledger.json");
function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return { used: 0, history: [] };
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
  } catch {
    return { used: 0, history: [] };
  }
}
function saveLedger(ledger) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}
function consumeLocalCredit({ service, amount, limit, allowOverIfSimulation }) {
  const ledger = loadLedger();
  const used = Number(ledger.used || 0);
  const next = used + Number(amount || 0);

  if (next > limit && !allowOverIfSimulation) {
    const err = new Error(`Local credit cap hit: used=${used}, want=${amount}, limit=${limit}`);
    err.code = "POC_LOCAL_CREDIT_LIMIT";
    throw err;
  }

  ledger.used = next;
  ledger.history.push({ ts: new Date().toISOString(), service, amount, usedAfter: next });
  saveLedger(ledger);
  return next;
}

function writeArtifact(name, payload) {
  const outDir = path.join(__dirname, "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, name);
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  return outFile;
}

function limitPush(arr, item, limit) {
  if (!limit || limit <= 0) return;
  if (arr.length >= limit) return;
  arr.push(item);
}

async function pollAtsStatus({ baseUrl, token, candidateId, jobId, maxPolls, intervalMs }) {
  const authHeaders = { Authorization: `Bearer ${token}` };
  const url = `${baseUrl}/api/candidates/ats/filter/job/${jobId}/`;
  let last = null;

  for (let i = 1; i <= maxPolls; i++) {
    const res = await requestJson(url, { method: "GET", headers: authHeaders }, 30_000);
    if (res.ok && Array.isArray(res.body)) {
      const found = res.body.find(
        (row) =>
          String(row?.candidate?._id || row?.candidate) === String(candidateId) ||
          String(row?.candidate?._id) === String(candidateId)
      );
      if (found) {
        last = found;
        if (found.aiCallStatus && found.aiCallStatus !== "pending") {
          return { ok: true, ats: found, poll: i };
        }
      }
    }
    await sleep(intervalMs);
  }

  return { ok: false, ats: last, poll: maxPolls };
}

function getWsUrl(baseUrl, candidateId, jobId, callUuid) {
  const wsBase = baseUrl.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
  return `${wsBase}/api/ai/call/ws/plivo/${candidateId}/${jobId}/${callUuid}/`;
}

function buildSilenceChunk(bytes = 160) {
  return Buffer.alloc(bytes, 0xFF); // µ-law silence is often 0xFF
}

function chunkBuffer(buf, chunkSize) {
  const chunks = [];
  for (let i = 0; i < buf.length; i += chunkSize) {
    chunks.push(buf.slice(i, i + chunkSize));
  }
  return chunks;
}

async function runWsSimulation({
  wsUrl,
  callUuid,
  durationMs,
  chunkBytes,
  chunkIntervalMs,
  audioFile,
  stripWavHeader,
  logLimit,
  logMessages,
}) {
  if (typeof WebSocket === "undefined") {
    throw new Error("Global WebSocket is not available in this Node runtime.");
  }

  logSection("Step 4: WebSocket Streaming (E2E)");
  console.log("[POC] wsUrl:", wsUrl);

  const ws = new WebSocket(wsUrl);

  const recvLog = [];
  const sendLog = [];
  const counters = { sent: 0, received: 0, playAudio: 0 };

  ws.onopen = async () => {
    // send start event
    ws.send(
      JSON.stringify({
        event: "start",
        start: { callId: callUuid },
      })
    );
    counters.sent += 1;
    limitPush(sendLog, { type: "start", ts: new Date().toISOString() }, logLimit);

    let chunks = [];
    if (audioFile) {
      const fullPath = path.isAbsolute(audioFile)
        ? audioFile
        : path.join(__dirname, audioFile);
      const raw = fs.readFileSync(fullPath);
      const payload = stripWavHeader ? raw.slice(44) : raw;
      chunks = chunkBuffer(payload, chunkBytes);
      console.log("[POC] Streaming audio file chunks:", chunks.length);
    }

    const startAt = Date.now();
    let idx = 0;

    while (Date.now() - startAt < durationMs) {
      const buf = chunks.length ? chunks[idx % chunks.length] : buildSilenceChunk(chunkBytes);
      const payload = buf.toString("base64");
      ws.send(JSON.stringify({ event: "media", media: { payload } }));
      counters.sent += 1;
      limitPush(sendLog, { type: "media", ts: new Date().toISOString(), bytes: buf.length }, logLimit);
      idx += 1;
      await sleep(chunkIntervalMs);
    }

    ws.send(JSON.stringify({ event: "stop" }));
    counters.sent += 1;
    limitPush(sendLog, { type: "stop", ts: new Date().toISOString() }, logLimit);

    // allow server to finish
    await sleep(500);
    ws.close();
  };

  ws.onmessage = (ev) => {
    counters.received += 1;
    try {
      const msg = JSON.parse(ev.data);
      if (msg?.event === "playAudio") {
        counters.playAudio += 1;
        const text = msg?.media?.audioText;
        if (text) {
          console.log(`[AI][${callUuid}] ${text}`);
        }
      }
      if (logMessages) {
        limitPush(recvLog, { ts: new Date().toISOString(), msg }, logLimit);
      }
    } catch {
      if (logMessages) {
        limitPush(recvLog, { ts: new Date().toISOString(), raw: String(ev.data) }, logLimit);
      }
    }
  };

  return new Promise((resolve) => {
    ws.onclose = () => {
      const wsFile = writeArtifact(`ai-calling.ws.${Date.now()}.json`, {
        wsUrl,
        sent: sendLog,
        received: recvLog,
        counters,
      });
      console.log("[POC] WS session closed. Log saved:", wsFile);
      resolve(wsFile);
    };
    ws.onerror = (err) => {
      console.log("[POC] WS error:", err?.message || err);
    };
  });
}

async function main() {
  loadLocalEnv(path.join(__dirname, ".env"));

  const baseUrl = (process.env.POC_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
  const email = process.env.POC_EMAIL;
  const password = process.env.POC_PASSWORD;
  const candidateId = process.env.POC_CANDIDATE_ID;
  const jobId = process.env.POC_JOB_ID;

  const enforceSimulation = boolFromEnv("POC_ENFORCE_SIMULATION", true);
  const creditLimit = numFromEnv("POC_CREDIT_LIMIT", 5);
  const callUuid = ensureSimulationCallUuid(process.env.POC_CALL_UUID, enforceSimulation);

  // WS simulation controls
  const wsDurationMs = numFromEnv("POC_WS_DURATION_MS", 5000);
  const wsChunkBytes = numFromEnv("POC_WS_CHUNK_BYTES", 160);
  const wsChunkIntervalMs = numFromEnv("POC_WS_CHUNK_INTERVAL_MS", 20);
  const wsAudioFile = process.env.POC_WS_AUDIO_FILE || "";
  const wsStripWavHeader = boolFromEnv("POC_WS_STRIP_WAV_HEADER", true);
  const wsLogLimit = numFromEnv("POC_WS_LOG_LIMIT", 200);
  const wsLogMessages = boolFromEnv("POC_WS_LOG_MESSAGES", false);

  const doHangup = boolFromEnv("POC_DO_HANGUP", true);
  const hangupDelayMs = numFromEnv("POC_HANGUP_DELAY_MS", 1500);
  const atsPollIntervalMs = numFromEnv("POC_ATS_POLL_INTERVAL_MS", 1500);
  const atsMaxPolls = numFromEnv("POC_ATS_MAX_POLLS", 10);

  logSection("AI Calling POC (Dev / Local E2E)");
  console.log("[POC] baseUrl:", baseUrl);
  console.log("[POC] candidateId:", candidateId);
  console.log("[POC] jobId:", jobId);
  console.log("[POC] callUuid:", callUuid);

  const missing = [];
  if (!email) missing.push("POC_EMAIL");
  if (!password) missing.push("POC_PASSWORD");
  if (!candidateId) missing.push("POC_CANDIDATE_ID");
  if (!jobId) missing.push("POC_JOB_ID");
  if (missing.length) throw new Error(`Missing required env(s): ${missing.join(", ")}`);

  logSection("Step 0: Local Credit Ledger (Soft Guard)");
  const usedAfter = consumeLocalCredit({
    service: "AI_CALLING_POC_E2E",
    amount: 1,
    limit: creditLimit,
    allowOverIfSimulation: enforceSimulation,
  });
  console.log("[POC] Local credits used:", `${usedAfter}/${creditLimit}`);

  logSection("Step 1: Login");
  const loginRes = await requestJson(
    `${baseUrl}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    30_000
  );

  if (!loginRes.ok) {
    console.log("[POC] Login failed:", loginRes.status, loginRes.body);
    throw new Error("Login failed. Check POC_EMAIL / POC_PASSWORD.");
  }

  const token = loginRes.body?.token;
  const user = loginRes.body?.user;
  console.log("[POC] Login OK. role:", user?.role, "| dbName:", loginRes.body?.dbName);
  if (!token) throw new Error("Login succeeded but no token returned.");

  const authHeaders = { Authorization: `Bearer ${token}` };

  logSection("Step 2: Credit Guard (Best Effort)");
  try {
    const adminsRes = await requestJson(`${baseUrl}/api/admins/`, {
      method: "GET",
      headers: authHeaders,
    });

    if (!adminsRes.ok || !Array.isArray(adminsRes.body)) {
      console.log("[POC] Skipping credit check (not ultra_admin or endpoint unavailable).");
    } else {
      const adminDoc = adminsRes.body.find(
        (a) =>
          String(a?.user?._id || a?.user) === String(user?._id) ||
          String(a?.client) === String(user?._id)
      );
      if (!adminDoc) {
        console.log("[POC] No matching admin doc found for credit check.");
      } else {
        const usedCredits = (adminDoc.totalCallCount || 0) * (adminDoc.creditRatePerCall || 0);
        console.log("[POC] usedCredits:", usedCredits, "| totalCredit:", adminDoc.totalCredit);
        if (usedCredits >= creditLimit && enforceSimulation) {
          console.log("[POC] Credit limit exceeded, but simulation mode is enforced.");
        } else if (usedCredits >= creditLimit) {
          throw new Error(`Credit guard triggered: usedCredits=${usedCredits} >= limit=${creditLimit}`);
        }
      }
    }
  } catch (err) {
    console.log("[POC] Credit check warning:", err?.message || err);
  }

  logSection("Step 3: Trigger AI Call (Simulation)");
  const triggerUrl = new URL(`${baseUrl}/api/ai/call/trigger/plivo/${candidateId}/${jobId}/`);
  triggerUrl.searchParams.set("callUUID", callUuid);

  const triggerRes = await requestJson(triggerUrl.toString(), { method: "GET", headers: authHeaders }, 60_000);
  console.log("[POC] Trigger response status:", triggerRes.status);
  console.log("[POC] Trigger response body:", triggerRes.body);

  if (!triggerRes.ok || triggerRes.body?.ok === false) {
    throw new Error(triggerRes.body?.message || "AI call trigger failed. Check backend env keys and IDs.");
  }

  const wsUrl = getWsUrl(baseUrl, candidateId, jobId, callUuid);
  await runWsSimulation({
    wsUrl,
    callUuid,
    durationMs: wsDurationMs,
    chunkBytes: wsChunkBytes,
    chunkIntervalMs: wsChunkIntervalMs,
    audioFile: wsAudioFile,
    stripWavHeader: wsStripWavHeader,
    logLimit: wsLogLimit,
    logMessages: wsLogMessages,
  });

  let hangupRes = null;
  let atsRes = null;

  if (doHangup) {
    logSection("Step 5: Hangup Webhook (Simulated)");
    await sleep(hangupDelayMs);

    const hangupUrl = `${baseUrl}/api/ai/call/hangup/plivo/${candidateId}/${jobId}/`;
    const hangupPayload = {
      CallUUID: callUuid,
      CallStatus: "completed",
      HangupCause: "NORMAL_CLEARING",
      HangupSource: "Callee",
    };

    hangupRes = await requestJson(
      hangupUrl,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(hangupPayload) },
      30_000
    );

    console.log("[POC] Hangup status:", hangupRes.status);
    console.log("[POC] Hangup response:", hangupRes.body);

    logSection("Step 6: Verify ATS Status");
    atsRes = await pollAtsStatus({
      baseUrl,
      token,
      candidateId,
      jobId,
      maxPolls: atsMaxPolls,
      intervalMs: atsPollIntervalMs,
    });

    console.log("[POC] ATS poll:", atsRes.ok ? "updated" : "not updated");
    if (atsRes.ats) {
      console.log("[POC] aiCallStatus:", atsRes.ats.aiCallStatus);
      console.log("[POC] aiCallHangUpCause:", atsRes.ats.aiCallHangUpCause);
      console.log("[POC] aiCallHangUpSource:", atsRes.ats.aiCallHangUpSource);
    }
  } else {
    logSection("Step 5: Hangup Webhook (Skipped)");
    console.log("[POC] POC_DO_HANGUP=false, skipping hangup + ATS check.");
  }

  const okFile = writeArtifact(`ai-calling.e2e.ok.${Date.now()}.json`, {
    meta: {
      poc: "AI_CALLING_E2E",
      baseUrl,
      candidateId,
      jobId,
      callUuid,
      createdAt: new Date().toISOString(),
    },
    trigger: triggerRes.body,
    hangup: hangupRes?.body ?? null,
    ats: atsRes?.ats ?? null,
  });

  logSection("Done");
  console.log("[POC] AI Calling E2E POC completed.");
  console.log("[POC] Output saved:", okFile);
}

main().catch((err) => {
  console.error("\n[POC] Failed:", err?.message || err);
  if (err?.code) console.error("[POC] code:", err.code);
  process.exit(1);
});