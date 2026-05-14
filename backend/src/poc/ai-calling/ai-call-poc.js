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

function classifyFromText(raw) {
  const t = String(raw || "").toLowerCase();
  if (t.includes("completed") || t.includes("succeeded") || t.includes("done") || t.includes("finished")) return "completed";
  if (t.includes("failed") || t.includes("error") || t.includes("cancelled") || t.includes("canceled")) return "failed";
  if (t.includes("running") || t.includes("in_progress") || t.includes("in progress") || t.includes("progress")) return "running";
  if (t.includes("queued") || t.includes("pending") || t.includes("created")) return "queued";
  return "unknown";
}

function deepPickStatus(obj) {
  if (!obj || typeof obj !== "object") return null;
  const direct = obj.status ?? obj.state ?? obj.callStatus ?? obj.call_state ?? obj.stage ?? obj.phase ?? null;
  if (direct != null) return direct;
  return (
    obj.details?.status ??
    obj.details?.state ??
    obj.details?.callStatus ??
    obj.data?.status ??
    obj.data?.state ??
    obj.data?.callStatus ??
    obj.data?.details?.status ??
    obj.data?.details?.callStatus ??
    obj.call?.status ??
    obj.call?.state ??
    obj.call?.callStatus ??
    obj.callLog?.status ??
    obj.callLog?.state ??
    obj.callLog?.callStatus ??
    obj.result?.status ??
    obj.result?.state ??
    null
  );
}

function getStatusFromBody(body) {
  if (Array.isArray(body)) {
    for (const item of body) {
      const s = deepPickStatus(item);
      if (s != null) return s;
    }
    return "unknown";
  }

  if (body?.raw) {
    const c = classifyFromText(body.raw);
    if (c !== "unknown") return c;
  }

  const picked = deepPickStatus(body);
  if (picked != null) return picked;

  if (body?.message) {
    const c = classifyFromText(body.message);
    if (c !== "unknown") return c;
  }

  if (body?.ok === true && (body?.done === true || body?.completed === true)) return "completed";
  return "unknown";
}

function isDone(status) {
  const s = String(status || "").toLowerCase();
  return ["completed", "succeeded", "done", "finished"].includes(s);
}
function isFailed(status) {
  const s = String(status || "").toLowerCase();
  return ["failed", "error", "cancelled", "canceled"].includes(s);
}

function writeArtifact(name, payload) {
  const outDir = path.join(__dirname, "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, name);
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  return outFile;
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

  const pollIntervalMs = numFromEnv("POC_POLL_INTERVAL_MS", 1500);
  const maxPolls = numFromEnv("POC_MAX_POLLS", 40);

  const statusPath = process.env.POC_STATUS_PATH || "/api/ai/call/status";
  const resultPath = process.env.POC_RESULT_PATH || "/api/ai/call/result";
  const fetchResult = boolFromEnv("POC_FETCH_RESULT", true);
  const debugStatus = boolFromEnv("POC_DEBUG_STATUS", true);
  const skipPolling = boolFromEnv("POC_SKIP_POLLING", false) || maxPolls <= 0 || !statusPath;

  logSection("AI Calling POC (Dev / Local)");
  console.log("[POC] baseUrl:", baseUrl);
  console.log("[POC] candidateId:", candidateId);
  console.log("[POC] jobId:", jobId);
  console.log("[POC] callUuid:", callUuid);
  console.log("[POC] creditLimit (soft guard):", creditLimit);

  const missing = [];
  if (!email) missing.push("POC_EMAIL");
  if (!password) missing.push("POC_PASSWORD");
  if (!candidateId) missing.push("POC_CANDIDATE_ID");
  if (!jobId) missing.push("POC_JOB_ID");
  if (missing.length) throw new Error(`Missing required env(s): ${missing.join(", ")}`);

  logSection("Step 0: Local Credit Ledger (Soft Guard)");
  const usedAfter = consumeLocalCredit({
    service: "AI_CALLING_POC",
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

  if (skipPolling) {
    logSection("Step 4: Poll Status (Skipped)");
    console.log("[POC] Skipping status polling. Treating trigger success as POC success.");

    const okFile = writeArtifact(`ai-calling.ok.${Date.now()}.json`, {
      meta: { poc: "AI_CALLING", baseUrl, candidateId, jobId, callUuid, createdAt: new Date().toISOString() },
      trigger: triggerRes.body,
      note: "Polling skipped by POC_SKIP_POLLING / POC_MAX_POLLS<=0 / empty status path.",
    });

    logSection("Done");
    console.log("[POC] AI Calling POC completed.");
    console.log("[POC] Output saved:", okFile);
    return;
  }

  logSection("Step 4: Poll Status");
  const statusUrl = new URL(`${baseUrl}${statusPath}`);
  statusUrl.searchParams.set("callUUID", callUuid);
  statusUrl.searchParams.set("candidateId", candidateId);
  statusUrl.searchParams.set("jobId", jobId);

  console.log("[POC] statusUrl:", statusUrl.toString());
  console.log("[POC] pollIntervalMs:", pollIntervalMs, "| maxPolls:", maxPolls);

  let lastStatusRes = null;
  let lastStatus = "unknown";
  let printedFirstBody = false;

  for (let i = 1; i <= maxPolls; i++) {
    const stRes = await requestJson(statusUrl.toString(), { method: "GET", headers: authHeaders }, 30_000);
    lastStatusRes = stRes;

    if (!printedFirstBody) {
      printedFirstBody = true;
      console.log("[POC] Status response (first poll) HTTP:", stRes.status);
      console.log("[POC] Status response (first poll) body:", JSON.stringify(stRes.body, null, 2));
    }

    if (!stRes.ok) {
      console.log(`[POC] Poll ${i}/${maxPolls}: HTTP ${stRes.status} (retrying...)`);
      await sleep(pollIntervalMs);
      continue;
    }

    lastStatus = getStatusFromBody(stRes.body);

    if (debugStatus && i <= 3) {
      console.log(`[POC] Status response (poll ${i}) body:`, JSON.stringify(stRes.body, null, 2));
    }

    console.log(`[POC] Poll ${i}/${maxPolls}: status=${lastStatus}`);

    if (isDone(lastStatus)) break;
    if (isFailed(lastStatus)) {
      const failFile = writeArtifact(`ai-calling.fail.${Date.now()}.json`, {
        meta: { baseUrl, candidateId, jobId, callUuid, statusUrl: statusUrl.toString(), createdAt: new Date().toISOString() },
        trigger: triggerRes.body,
        lastStatusPayload: stRes.body,
      });
      throw new Error(`[POC] Call failed. Saved: ${failFile}`);
    }

    await sleep(pollIntervalMs);
  }

  if (!isDone(lastStatus)) {
    const failFile = writeArtifact(`ai-calling.timeout.${Date.now()}.json`, {
      meta: { baseUrl, candidateId, jobId, callUuid, statusUrl: statusUrl.toString(), createdAt: new Date().toISOString() },
      trigger: triggerRes.body,
      lastStatusPayload: lastStatusRes?.body ?? null,
    });
    throw new Error(`[POC] Timeout: call did not complete. lastStatus=${lastStatus}. Saved: ${failFile}`);
  }

  logSection("Step 5: Fetch Result (Optional)");
  let resultBody = null;

  if (fetchResult) {
    const resultUrl = new URL(`${baseUrl}${resultPath}`);
    resultUrl.searchParams.set("callUUID", callUuid);
    resultUrl.searchParams.set("candidateId", candidateId);
    resultUrl.searchParams.set("jobId", jobId);

    console.log("[POC] resultUrl:", resultUrl.toString());

    const rr = await requestJson(resultUrl.toString(), { method: "GET", headers: authHeaders }, 30_000);
    if (rr.ok) {
      resultBody = rr.body;
      console.log("[POC] Result fetched OK.");
    } else {
      console.log("[POC] Result fetch failed:", rr.status, rr.body);
    }
  } else {
    console.log("[POC] POC_FETCH_RESULT=false, skipping result fetch.");
  }

  const okFile = writeArtifact(`ai-calling.ok.${Date.now()}.json`, {
    meta: { poc: "AI_CALLING", baseUrl, candidateId, jobId, callUuid, createdAt: new Date().toISOString() },
    trigger: triggerRes.body,
    lastStatusPayload: lastStatusRes?.body ?? null,
    result: resultBody,
  });

  logSection("Done");
  console.log("[POC] AI Calling POC completed.");
  console.log("[POC] Output saved:", okFile);
}

main().catch((err) => {
  console.error("\n[POC] Failed:", err?.message || err);
  if (err?.code) console.error("[POC] code:", err.code);
  process.exit(1);
});