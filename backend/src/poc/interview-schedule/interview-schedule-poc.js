/**
 * Interview Schedule POC (Dev/Local)
 * Flow:
 *  - load .env
 *  - login
 *  - resolve CandidateATS (+ candidateId/jobId)
 *  - create schedule (optional)
 *  - list schedules, view, read
 *  - update (optional)
 *  - virtual-only: activate link, fetch script, reshare link (optional)
 *  - transcript, latest-video, report (optional)
 *  - archive/unarchive/delete (optional)
 */

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

function csvToArray(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function csvToNumberArray(value) {
  return csvToArray(value)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
}

function parseJsonEnv(name, fallback) {
  const raw = (process.env[name] ?? "").toString().trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
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

async function requestBinary(url, options = {}, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const buffer = await res.arrayBuffer();
    return { ok: res.ok, status: res.status, buffer, headers: res.headers };
  } finally {
    clearTimeout(timeout);
  }
}

function writeArtifact(name, payload) {
  const outDir = path.join(__dirname, "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, name);
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  return outFile;
}

function writeBinary(name, buffer) {
  const outDir = path.join(__dirname, "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, name);
  fs.writeFileSync(outFile, Buffer.from(buffer));
  return outFile;
}

function formatDateLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeLocal(d) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function listFromBody(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.items)) return body.items;
  return [];
}

function pickLatestSchedule(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const byDate = [...items].sort((a, b) => {
    const aTime = new Date(a?.startAt || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.startAt || b?.createdAt || 0).getTime();
    return bTime - aTime;
  });
  return byDate[0] || null;
}

async function resolveCandidateATS({
  baseUrl,
  authHeaders,
  candidateATSId,
  candidateId,
  jobId,
  steps,
}) {
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };

  // If ATS ID exists, hydrate candidate/job if missing
  if (candidateATSId && (!candidateId || !jobId)) {
    const res = await requestJson(
      `${baseUrl}/api/candidates/ats/${candidateATSId}`,
      { method: "GET", headers: authHeaders }
    );
    steps.push({ step: "get_candidate_ats", ok: res.ok, status: res.status, body: res.body });
    if (res.ok) {
      candidateId = candidateId || res.body?.candidate;
      jobId = jobId || res.body?.job;
    }
  }

  // If ATS ID missing, attempt to derive from candidateId + jobId
  if (!candidateATSId && candidateId && jobId) {
    const res = await requestJson(
      `${baseUrl}/api/candidates/ats?candidateId=${candidateId}&jobId=${jobId}`,
      { method: "GET", headers: authHeaders }
    );
    steps.push({ step: "find_candidate_ats", ok: res.ok, status: res.status, body: res.body });
    if (res.ok) {
      const candidates = listFromBody(res.body);
      for (const cand of candidates) {
        const apps = Array.isArray(cand?.applications) ? cand.applications : [];
        const match = apps.find((app) => {
          const appJobId = app?.job?._id || app?.job;
          return appJobId && String(appJobId) === String(jobId);
        });
        if (match?._id) {
          candidateATSId = String(match._id);
          break;
        }
      }
      if (!candidateATSId && candidates[0]?.applications?.[0]?._id) {
        candidateATSId = String(candidates[0].applications[0]._id);
      }
    }
  }

  // If ATS ID still missing, try listing recent ATS and pick first
  if (!candidateATSId) {
    const res = await requestJson(
      `${baseUrl}/api/candidates/ats?page=1&pageSize=5`,
      { method: "GET", headers: jsonHeaders }
    );
    steps.push({ step: "list_candidate_ats_fallback", ok: res.ok, status: res.status, body: res.body });
    if (res.ok) {
      const candidates = listFromBody(res.body);
      const firstApp = candidates?.[0]?.applications?.[0];
      if (firstApp?._id) {
        candidateATSId = String(firstApp._id);
        candidateId = candidateId || candidates?.[0]?._id;
        const appJobId = firstApp?.job?._id || firstApp?.job;
        jobId = jobId || appJobId;
      }
    }
  }

  return { candidateATSId, candidateId, jobId };
}

async function main() {
  loadLocalEnv(path.join(__dirname, ".env"));

  const baseUrl = (process.env.POC_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
  const frontendOrigin = (process.env.POC_FRONTEND_ORIGIN || "").trim();
  const email = process.env.POC_EMAIL;
  const password = process.env.POC_PASSWORD;

  let candidateATSId = (process.env.POC_CANDIDATE_ATS_ID || "").trim();
  let candidateId = (process.env.POC_CANDIDATE_ID || "").trim();
  let jobId = (process.env.POC_JOB_ID || "").trim();
  let scheduleId = (process.env.POC_INTERVIEW_SCHEDULE_ID || "").trim();

  const steps = [];
  const startedAt = new Date().toISOString();

  logSection("Interview Schedule POC (Dev / Local)");
  console.log("[POC] baseUrl:", baseUrl);

  if (!email || !password) {
    throw new Error("Missing POC_EMAIL or POC_PASSWORD.");
  }

  logSection("Step 1: Login");
  const loginRes = await requestJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  steps.push({ step: "login", ok: loginRes.ok, status: loginRes.status, body: loginRes.body });

  if (!loginRes.ok) {
    throw new Error("Login failed. Check POC_EMAIL / POC_PASSWORD.");
  }
  const token = loginRes.body?.token;
  if (!token) throw new Error("Login succeeded but no token returned.");

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    ...(frontendOrigin ? { "x-frontend-origin": frontendOrigin } : {}),
  };
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };

  // If scheduleId provided, hydrate candidate/job/ats
  if (scheduleId) {
    const res = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}`,
      { method: "GET", headers: authHeaders }
    );
    steps.push({ step: "read_schedule_seed", ok: res.ok, status: res.status, body: res.body });
    if (res.ok) {
      candidateATSId = candidateATSId || res.body?.candidateATS;
      candidateId = candidateId || res.body?.candidate;
      jobId = jobId || res.body?.job;
    }
  }

  // Resolve ATS + candidate/job IDs
  logSection("Step 2: Resolve CandidateATS");
  const resolved = await resolveCandidateATS({
    baseUrl,
    authHeaders,
    candidateATSId,
    candidateId,
    jobId,
    steps,
  });
  candidateATSId = resolved.candidateATSId;
  candidateId = resolved.candidateId;
  jobId = resolved.jobId;

  if (!candidateATSId) {
    throw new Error("Could not resolve CandidateATS ID. Set POC_CANDIDATE_ATS_ID.");
  }

  const interviewMode = (process.env.POC_INTERVIEW_MODE || "Phone").trim();
  const interviewerType = (process.env.POC_INTERVIEWER_TYPE || "AI").trim();
  const interviewType = (process.env.POC_INTERVIEW_TYPE || "Technical").trim();
  const difficultyLevel = (process.env.POC_DIFFICULTY_LEVEL || "Intermediate").trim();
  const durationMinutes = numFromEnv("POC_DURATION_MINUTES", 30);
  const timezone = (process.env.POC_TIMEZONE || "").trim();
  const notes = (process.env.POC_NOTES || "POC interview schedule").trim();

  let interviewDate = (process.env.POC_INTERVIEW_DATE || "").trim();
  let startTime = (process.env.POC_START_TIME || "").trim();
  if (!interviewDate || !startTime) {
    const offsetMin = numFromEnv("POC_START_IN_MINUTES", 10);
    const startAt = new Date(Date.now() + offsetMin * 60 * 1000);
    interviewDate = interviewDate || formatDateLocal(startAt);
    startTime = startTime || formatTimeLocal(startAt);
  }

  const meetingLink = (process.env.POC_MEETING_LINK || "").trim();
  const locationAddress = (process.env.POC_LOCATION_ADDRESS || "").trim();
  const interviewers = csvToArray(process.env.POC_INTERVIEWERS);
  const technicalScript = (process.env.POC_TECHNICAL_SCRIPT || "").trim();
  const selectedBlueprint = parseJsonEnv("POC_SELECTED_BLUEPRINT_JSON", []);

  const roundType = (process.env.POC_ROUND_TYPE || "Speaking").trim();
  const codingConfig = {
    questionLevel: (process.env.POC_CODING_QUESTION_LEVEL || "Medium").trim(),
    averageTestCases: numFromEnv("POC_CODING_TEST_CASES", 5),
    questionType: (process.env.POC_CODING_QUESTION_TYPE || "DSA").trim(),
    allowedLanguages: csvToNumberArray(process.env.POC_CODING_ALLOWED_LANGUAGES),
  };

  if (interviewMode === "Phone" && !meetingLink) {
    throw new Error("POC_MEETING_LINK is required for Phone interviews.");
  }
  if (interviewMode === "Onsite" && !locationAddress) {
    throw new Error("POC_LOCATION_ADDRESS is required for Onsite interviews.");
  }
  if ((interviewerType === "Human" || interviewerType === "Human+AI") && interviewers.length === 0) {
    throw new Error("POC_INTERVIEWERS is required for Human or Human+AI interviews.");
  }

  const createSchedule = boolFromEnv("POC_CREATE_SCHEDULE", true);

  if (createSchedule) {
    logSection("Step 3: Create Interview Schedule");
    const payload = {
      candidateATS: candidateATSId,
      candidate: candidateId || undefined,
      job: jobId || undefined,
      interviewMode,
      meetingLink,
      locationAddress,
      interviewDate,
      startTime,
      durationMinutes,
      timezone,
      notes,
      interviewers,
      selectedBlueprint,
      technicalScript,
      interviewerType,
      interviewType,
      difficultyLevel,
      roundType,
      codingConfig,
    };

    const res = await requestJson(`${baseUrl}/api/interviewschedules`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    steps.push({ step: "create_schedule", ok: res.ok, status: res.status, body: res.body });

    if (!res.ok) {
      throw new Error(`Create schedule failed: ${res.body?.error || res.body?.message || res.status}`);
    }

    scheduleId = res.body?._id || scheduleId;
  }

  logSection("Step 4: List Schedules");
  const listRes = await requestJson(
    `${baseUrl}/api/interviewschedules?candidateATS=${candidateATSId}`,
    { method: "GET", headers: authHeaders }
  );
  steps.push({ step: "list_schedules", ok: listRes.ok, status: listRes.status, body: listRes.body });

  if (!scheduleId && listRes.ok) {
    const items = listFromBody(listRes.body);
    const latest = pickLatestSchedule(items);
    if (latest?._id) scheduleId = String(latest._id);
  }

  logSection("Step 5: View Init Data");
  const viewRes = await requestJson(
    `${baseUrl}/api/interviewschedules/view?candidateATS=${candidateATSId}`,
    { method: "GET", headers: authHeaders }
  );
  steps.push({ step: "view_init", ok: viewRes.ok, status: viewRes.status, body: viewRes.body });

  if (scheduleId) {
    logSection("Step 6: Read Schedule");
    const readRes = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}`,
      { method: "GET", headers: authHeaders }
    );
    steps.push({ step: "read_schedule", ok: readRes.ok, status: readRes.status, body: readRes.body });
  }

  if (scheduleId && boolFromEnv("POC_UPDATE_AFTER_CREATE", true)) {
    logSection("Step 7: Update Schedule");
    const updatePayload = {
      notes: `${notes} (updated @ ${new Date().toISOString()})`,
    };
    const updateRes = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}`,
      { method: "PUT", headers: jsonHeaders, body: JSON.stringify(updatePayload) }
    );
    steps.push({ step: "update_schedule", ok: updateRes.ok, status: updateRes.status, body: updateRes.body });
  }

  if (scheduleId && interviewMode === "Virtual" && boolFromEnv("POC_ACTIVATE_LINK", true)) {
    logSection("Step 8: Activate WebRTC Link");
    const activateRes = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}/activate-link`,
      { method: "POST", headers: authHeaders }
    );
    steps.push({ step: "activate_link", ok: activateRes.ok, status: activateRes.status, body: activateRes.body });

    const token = activateRes.body?.webrtcAccessToken || activateRes.body?.item?.webrtcAccessToken;
    const candidateForScript = candidateId || activateRes.body?.candidate || activateRes.body?.item?.candidate;
    const jobForScript = jobId || activateRes.body?.job || activateRes.body?.item?.job;

    if (candidateForScript && jobForScript) {
      logSection("Step 9: Fetch WebRTC Script");
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
      const scriptRes = await requestJson(
        `${baseUrl}/api/interviewschedules/script?candidateId=${candidateForScript}&jobId=${jobForScript}${tokenParam}`,
        { method: "GET", headers: authHeaders }
      );
      steps.push({ step: "get_script", ok: scriptRes.ok, status: scriptRes.status, body: scriptRes.body });
    }
  }

  if (scheduleId && interviewMode === "Virtual" && boolFromEnv("POC_ACTIVATE_RESHARE", false)) {
    logSection("Step 10: Activate + Reshare Link");
    const hours = numFromEnv("POC_RESHARE_WINDOW_HOURS", 48);
    const reshareRes = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}/activate-reshare`,
      { method: "POST", headers: jsonHeaders, body: JSON.stringify({ activeWindowHours: hours }) }
    );
    steps.push({ step: "activate_reshare", ok: reshareRes.ok, status: reshareRes.status, body: reshareRes.body });
  }

  if (scheduleId) {
    logSection("Step 11: Transcript");
    const transcriptRes = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}/transcript`,
      { method: "GET", headers: authHeaders }
    );
    steps.push({ step: "transcript", ok: transcriptRes.ok, status: transcriptRes.status, body: transcriptRes.body });
  }

  if (candidateId && jobId) {
    logSection("Step 12: Latest Video");
    const latestVideoRes = await requestJson(
      `${baseUrl}/api/interviewschedules/latest-video?candidateId=${candidateId}&jobId=${jobId}`,
      { method: "GET", headers: authHeaders }
    );
    steps.push({ step: "latest_video", ok: latestVideoRes.ok, status: latestVideoRes.status, body: latestVideoRes.body });
  }

  if (scheduleId && boolFromEnv("POC_FETCH_REPORT", false)) {
    logSection("Step 13: Interview Report PDF");
    const reportRes = await requestBinary(
      `${baseUrl}/api/interviewschedules/${scheduleId}/report`,
      { method: "GET", headers: authHeaders }
    );
    steps.push({ step: "report_pdf", ok: reportRes.ok, status: reportRes.status, note: "binary" });
    if (reportRes.ok) {
      const filename = `interview-report.${scheduleId}.pdf`;
      writeBinary(filename, reportRes.buffer);
    }
  }

  if (scheduleId && boolFromEnv("POC_ARCHIVE_AFTER", false)) {
    logSection("Step 14: Archive");
    const archiveRes = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}/archive`,
      { method: "PUT", headers: authHeaders }
    );
    steps.push({ step: "archive", ok: archiveRes.ok, status: archiveRes.status, body: archiveRes.body });
  }

  if (scheduleId && boolFromEnv("POC_UNARCHIVE_AFTER", false)) {
    logSection("Step 15: Unarchive");
    const unarchiveRes = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}/unarchive`,
      { method: "PUT", headers: authHeaders }
    );
    steps.push({ step: "unarchive", ok: unarchiveRes.ok, status: unarchiveRes.status, body: unarchiveRes.body });
  }

  if (scheduleId && boolFromEnv("POC_DELETE_AFTER", false)) {
    logSection("Step 16: Delete");
    const delRes = await requestJson(
      `${baseUrl}/api/interviewschedules/${scheduleId}`,
      { method: "DELETE", headers: authHeaders }
    );
    steps.push({ step: "delete", ok: delRes.ok, status: delRes.status, body: delRes.body });
  }

  const output = {
    poc: "INTERVIEW_SCHEDULE",
    startedAt,
    baseUrl,
    candidateATSId,
    candidateId,
    jobId,
    scheduleId,
    steps,
  };

  const outFile = writeArtifact(`interview-schedule.ok.${Date.now()}.json`, output);
  console.log("[POC] Done. Output:", outFile);
}

main().catch((err) => {
  const payload = {
    poc: "INTERVIEW_SCHEDULE",
    failedAt: new Date().toISOString(),
    error: err?.message || String(err),
  };
  const outFile = writeArtifact(`interview-schedule.fail.${Date.now()}.json`, payload);
  console.error("[POC] Failed:", err?.message || err);
  console.error("[POC] Output:", outFile);
  process.exit(1);
});