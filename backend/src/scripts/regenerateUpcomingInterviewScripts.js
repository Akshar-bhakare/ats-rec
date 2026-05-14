#!/usr/bin/env node
import dns from 'node:dns';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
    const envPaths = [
        path.resolve(__dirname, '../../.env'),
        path.resolve(__dirname, '../../../.env'),
    ];

    for (const envPath of envPaths) {
        dotenv.config({ path: envPath, override: false });
    }
}

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token || !token.startsWith('--')) continue;

        const eqIndex = token.indexOf('=');
        if (eqIndex !== -1) {
            const key = token.slice(2, eqIndex);
            const value = token.slice(eqIndex + 1);
            args[key] = value;
            continue;
        }

        const key = token.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
            args[key] = next;
            i += 1;
        } else {
            args[key] = true;
        }
    }
    return args;
}

function parseBool(value, defaultValue = false) {
    if (value === undefined) return defaultValue;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return defaultValue;
}

function parseNumber(value, defaultValue = null) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const n = Number(value);
    return Number.isFinite(n) ? n : defaultValue;
}

function parseCsvList(value) {
    if (value === undefined || value === null) return [];
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function extractMongoSrvHost(mongoUri) {
    const value = String(mongoUri || '').trim();
    if (!/^mongodb\+srv:\/\//i.test(value)) return null;

    const withoutScheme = value.replace(/^mongodb\+srv:\/\//i, '');
    const atIndex = withoutScheme.lastIndexOf('@');
    const hostPart = atIndex >= 0 ? withoutScheme.slice(atIndex + 1) : withoutScheme;
    const host = hostPart.split('/')[0].split('?')[0].trim();
    return host || null;
}

async function ensureMongoSrvDns({
    mongoUri,
    dnsServersArg,
    log,
}) {
    const host = extractMongoSrvHost(mongoUri);
    if (!host) {
        log?.step?.('bootstrap:dns:skip', { reason: 'non_srv_uri' });
        return;
    }

    const srvRecord = `_mongodb._tcp.${host}`;
    const resolveSrv = async (label) => {
        try {
            const records = await dns.promises.resolveSrv(srvRecord);
            log?.step?.('bootstrap:dns:srv:ok', {
                label,
                srvRecord,
                records: records.length,
            });
            return { ok: true, error: null };
        } catch (error) {
            log?.warn?.(`action=dns_srv_lookup_failed label=${label} code=${error?.code || 'unknown'} reason=${error?.message || error}`);
            return { ok: false, error };
        }
    };

    log?.step?.('bootstrap:dns:srv:check:start', { srvRecord });
    const primary = await resolveSrv('system');
    if (primary.ok) {
        return;
    }

    const fallbackServers = parseCsvList(
        dnsServersArg ||
        process.env.MONGO_DNS_SERVERS ||
        process.env.DNS_SERVERS ||
        '8.8.8.8,1.1.1.1'
    );

    if (!fallbackServers.length) {
        throw new Error(
            `Mongo SRV DNS lookup failed for ${srvRecord} and no fallback DNS servers configured.`
        );
    }

    try {
        dns.setServers(fallbackServers);
        if (typeof dns.setDefaultResultOrder === 'function') {
            dns.setDefaultResultOrder('ipv4first');
        }
        log?.step?.('bootstrap:dns:fallback:set', { servers: fallbackServers });
    } catch (error) {
        throw new Error(`Failed to set fallback DNS servers (${fallbackServers.join(', ')}): ${error?.message || error}`);
    }

    const fallback = await resolveSrv('fallback');
    if (!fallback.ok) {
        throw new Error(
            `Mongo SRV DNS lookup failed for ${srvRecord} using system and fallback DNS servers. Last error: ${fallback.error?.message || fallback.error}`
        );
    }
}

function printUsage() {
    console.log(`
Usage:
  node src/scripts/regenerateUpcomingInterviewScripts.js [options]

Options:
  --dbName <name>             Run only one tenant database.
  --globalDbName <name>       Global/admin database name (default: env DEFAULT_DB_NAME).
  --mongoUri <uri>            Override Mongo URI (optional).
  --dnsServers <csv>          Fallback DNS servers for SRV lookup (default: 8.8.8.8,1.1.1.1).
  --interviewerType <type>    Filter by interviewer type (AI, Human, Human+AI).
  --includeCoding <bool>      Include Coding rounds (default: false).
  --limit <number>            Process first N matching schedules per DB.
  --dryRun <bool>             Generate and log without DB updates.
  --yes                       Skip confirmation prompt.
  --help                      Show this usage.

Default behavior:
  If --dbName is not provided, the script auto-discovers ALL tenant DBs from
  global ClientAdmin.clientCompany and regenerates interview scripts in all of them.
    `.trim());
}

function createLogger(dbName = 'global') {
    const prefix = `[INTERVIEW_SCRIPT_REGEN][${dbName}]`;
    let stepCount = 0;

    const write = (method, message, meta) => {
        const ts = new Date().toISOString();
        const line = `${ts} ${prefix} ${message}`;
        if (meta && Object.keys(meta).length > 0) {
            console[method](line, meta);
        } else {
            console[method](line);
        }
    };
    return {
        info: (message, meta) => write('log', message, meta),
        warn: (message, meta) => write('warn', message, meta),
        error: (message, meta) => write('error', message, meta),
        step: (name, meta) => {
            stepCount += 1;
            write('log', `step=${stepCount} ${name}`, meta);
        },
        section: (title) => write('log', `========== ${title} ==========`),
    };
}

function askQuestion(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function confirmProceed({ autoApprove, prompt, log }) {
    if (autoApprove) return true;
    if (!process.stdin.isTTY) {
        log.warn('action=confirm skipped reason=non_tty use --yes to auto-approve');
        return false;
    }

    const answer = await askQuestion(prompt);
    const yes = ['y', 'yes'].includes(String(answer || '').trim().toLowerCase());
    log.info(`action=confirm response=${yes ? 'yes' : 'no'}`);
    return yes;
}

function normalizeDbName(value) {
    return String(value || '').trim();
}

async function resolveTenantDbNames({ dbName, globalConn, log }) {
    if (dbName) {
        log?.step?.('target_db:single', { dbName });
        return [dbName];
    }

    const ClientAdmin = globalConn?.models?.ClientAdmin;
    if (!ClientAdmin) {
        throw new Error('ClientAdmin model not available on global connection.');
    }

    log?.step?.('target_db:discover:start');
    const names = await ClientAdmin.distinct('clientCompany', {
        clientCompany: { $exists: true, $ne: null },
    }).exec();

    const seen = new Set();
    const dbs = [];
    for (const raw of names || []) {
        const parsed = normalizeDbName(raw);
        if (!parsed) continue;
        const key = parsed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        dbs.push(parsed);
    }

    log?.step?.('target_db:discover:done', { discovered: dbs.length });
    return dbs;
}

async function processTenantDb({
    dbName,
    getClientDbConn,
    InterviewScheduleService,
    includeCoding,
    interviewerTypeArg,
    limit,
    dryRun,
    dbIndex = null,
    dbTotal = null,
}) {
    const log = createLogger(dbName);
    const metrics = {
        scanned: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        planned: 0,
    };

    try {
        log.section(
            `DB START ${dbIndex && dbTotal ? `${dbIndex}/${dbTotal} ` : ''}${dbName}`
        );
        log.step('db:connect:start');
        const conn = await getClientDbConn(dbName);
        log.step('db:connect:done', { connectionName: conn?.name || null });

        const InterviewSchedule = conn.models['InterviewSchedule'];
        const Candidate = conn.models['Candidate'];
        const Job = conn.models['Job'];

        if (!InterviewSchedule || !Candidate || !Job) {
            throw new Error('Required models (InterviewSchedule/Candidate/Job) are not registered.');
        }

        const baseFilter = {
            isArchived: false,
        };

        if (!includeCoding) {
            baseFilter.roundType = { $ne: 'Coding' };
        }
        if (interviewerTypeArg) {
            baseFilter.interviewerType = interviewerTypeArg;
        }

        log.step('db:preflight:count_target:start', {
            includeCoding,
            interviewerType: interviewerTypeArg || 'any',
            limitPerDb: limit ?? 'none'
        });
        const totalMatching = await InterviewSchedule.countDocuments(baseFilter);
        metrics.planned = Number.isFinite(limit) && limit > 0 ? Math.min(limit, totalMatching) : totalMatching;
        log.step('db:preflight:count_target:done', {
            totalMatching,
            planned: metrics.planned
        });

        if (metrics.planned === 0) {
            log.info('action=done reason=no_matching_interviews');
            return { ok: true, ...metrics };
        }

        const findQuery = InterviewSchedule.find(baseFilter)
            .sort({ startAt: 1, createdAt: 1 })
            .select('_id candidate job interviewType');

        if (Number.isFinite(limit) && limit > 0) {
            findQuery.limit(limit);
        }

        log.step('db:schedule_fetch:start');
        const schedules = await findQuery.lean().exec();
        log.step('db:schedule_fetch:done', { fetched: schedules.length });
        const interviewSvc = new InterviewScheduleService();

        for (let idx = 0; idx < schedules.length; idx += 1) {
            const schedule = schedules[idx];
            metrics.scanned += 1;
            const scheduleId = String(schedule._id);
            const scheduleTag = `schedule ${idx + 1}/${schedules.length}`;
            let stage = 'start';

            try {
                log.step(`${scheduleTag}:start`, {
                    scheduleId,
                    interviewType: schedule.interviewType || 'Technical'
                });

                stage = 'load_candidate_job';
                log.step(`${scheduleTag}:load_candidate_job:start`, { scheduleId });
                const [candidate, job] = await Promise.all([
                    Candidate.findById(schedule.candidate)
                        .select('firstName lastName email')
                        .lean()
                        .exec(),
                    Job.findById(schedule.job)
                        .select('title internalTitle description company primarySkills')
                        .populate({ path: 'company', select: 'name' })
                        .lean()
                        .exec(),
                ]);
                log.step(`${scheduleTag}:load_candidate_job:done`, {
                    scheduleId,
                    hasCandidate: !!candidate,
                    hasJob: !!job
                });

                if (!candidate || !job) {
                    metrics.skipped += 1;
                    log.warn(`action=skip scheduleId=${scheduleId} reason=missing_candidate_or_job`);
                    continue;
                }

                stage = 'generate_script';
                const genStart = Date.now();
                log.step(`${scheduleTag}:generate_script:start`, { scheduleId });
                const technicalScript = await interviewSvc.buildScriptTemplateByInterviewType({
                    interviewType: schedule.interviewType || 'Technical',
                    candidate,
                    job,
                });
                log.step(`${scheduleTag}:generate_script:done`, {
                    scheduleId,
                    scriptLength: String(technicalScript || '').length,
                    durationMs: Date.now() - genStart
                });

                if (!technicalScript || !String(technicalScript).trim()) {
                    metrics.failed += 1;
                    log.error(`action=error scheduleId=${scheduleId} reason=empty_generated_script`);
                    continue;
                }

                if (dryRun) {
                    metrics.updated += 1;
                    log.info(`action=dry_run scheduleId=${scheduleId} scriptLength=${technicalScript.length}`);
                    continue;
                }

                stage = 'update_schedule';
                log.step(`${scheduleTag}:update_schedule:start`, { scheduleId });
                const result = await InterviewSchedule.updateOne(
                    { _id: schedule._id, isArchived: false },
                    { $set: { technicalScript: String(technicalScript).trim() } }
                ).exec();

                if (result?.matchedCount > 0) {
                    metrics.updated += 1;
                    log.info(`action=updated scheduleId=${scheduleId}`);
                    log.step(`${scheduleTag}:update_schedule:done`, {
                        scheduleId,
                        matchedCount: result?.matchedCount || 0,
                        modifiedCount: result?.modifiedCount || 0
                    });
                } else {
                    metrics.failed += 1;
                    log.error(`action=error scheduleId=${scheduleId} reason=not_matched_for_update`);
                }
            } catch (err) {
                metrics.failed += 1;
                log.error(`action=error scheduleId=${scheduleId} stage=${stage} reason=${err?.message || err}`);
            }
        }

        log.info(
            `action=summary planned=${metrics.planned} scanned=${metrics.scanned} updated=${metrics.updated} skipped=${metrics.skipped} failed=${metrics.failed}`
        );
        log.section(
            `DB END ${dbIndex && dbTotal ? `${dbIndex}/${dbTotal} ` : ''}${dbName}`
        );
        return { ok: true, ...metrics };
    } catch (err) {
        log.error(`action=fatal reason=${err?.message || err}`);
        log.section(
            `DB END ${dbIndex && dbTotal ? `${dbIndex}/${dbTotal} ` : ''}${dbName}`
        );
        return { ok: false, ...metrics, failed: metrics.failed + 1 };
    }
}

async function closeAllConnections() {
    const conns = mongoose.connections || [];
    await Promise.allSettled(conns.map((conn) => conn.close()));
}

async function main() {
    loadEnv();
    const args = parseArgs(process.argv.slice(2));

    if (args.help || args.h) {
        printUsage();
        process.exitCode = 0;
        return;
    }

    const mongoUriArg = args.mongoUri ? String(args.mongoUri) : null;
    if (mongoUriArg) {
        process.env.MONGODB_URI = mongoUriArg;
        process.env.MONGO_URI = mongoUriArg;
    } else if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
        process.env.MONGODB_URI = process.env.MONGO_URI;
    } else if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
        process.env.MONGO_URI = process.env.MONGODB_URI;
    }

    if (!process.env.MONGODB_URI) {
        console.error('Missing Mongo URI. Set MONGODB_URI (or MONGO_URI) or pass --mongoUri=<connectionString>.');
        process.exitCode = 1;
        return;
    }

    const dbNameArg = normalizeDbName(args.dbName);
    const globalDbName = normalizeDbName(args.globalDbName || process.env.DEFAULT_DB_NAME);
    if (!globalDbName) {
        console.error('Missing global DB name. Set DEFAULT_DB_NAME or pass --globalDbName=<name>.');
        process.exitCode = 1;
        return;
    }
    process.env.DEFAULT_DB_NAME = globalDbName;

    const dryRun = parseBool(args.dryRun, false);
    const autoApprove = parseBool(args.yes !== undefined ? args.yes : args.autoApprove, false);
    const includeCoding = parseBool(args.includeCoding, false);
    const limit = parseNumber(args.limit, null);
    const interviewerTypeArg = args.interviewerType ? String(args.interviewerType).trim() : null;
    const dnsServersArg = args.dnsServers ? String(args.dnsServers).trim() : null;

    const rootLog = createLogger('global');
    rootLog.section('RUN START');
    rootLog.info(
        `action=start scope=${dbNameArg || 'all_tenants'} globalDb=${globalDbName} dryRun=${dryRun} includeCoding=${includeCoding} limitPerDb=${limit ?? 'none'} interviewerType=${interviewerTypeArg || 'any'}`
    );

    try {
        await ensureMongoSrvDns({
            mongoUri: process.env.MONGODB_URI,
            dnsServersArg,
            log: rootLog,
        });

        rootLog.step('bootstrap:import_modules:start');
        const [{ getClientDbConn }, { default: InterviewScheduleService }] = await Promise.all([
            import('../utils/clientDbUtils.js'),
            import('../services/VirtualInterview/interviewScheduleService.js'),
        ]);
        rootLog.step('bootstrap:import_modules:done');

        rootLog.step('bootstrap:connect_global_db:start', { globalDbName });
        const globalConn = await getClientDbConn(globalDbName);
        rootLog.step('bootstrap:connect_global_db:done', { connectionName: globalConn?.name || null });
        const targetDbNames = await resolveTenantDbNames({ dbName: dbNameArg, globalConn, log: rootLog });

        if (!targetDbNames.length) {
            rootLog.warn('action=done reason=no_target_databases');
            rootLog.section('RUN END');
            process.exitCode = 0;
            return;
        }

        rootLog.info(`action=discovered dbCount=${targetDbNames.length}`, { dbNames: targetDbNames });

        const shouldProceed = await confirmProceed({
            autoApprove,
            log: rootLog,
            prompt: `${new Date().toISOString()} [INTERVIEW_SCRIPT_REGEN][global] Regenerate scripts in ${targetDbNames.length} database(s)? (yes/no): `,
        });
        if (!shouldProceed) {
            rootLog.info('action=cancelled');
            rootLog.section('RUN END');
            process.exitCode = 0;
            return;
        }

        const totals = {
            dbs: targetDbNames.length,
            dbsSucceeded: 0,
            dbsFailed: 0,
            planned: 0,
            scanned: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
        };

        for (let i = 0; i < targetDbNames.length; i += 1) {
            const tenantDbName = targetDbNames[i];
            rootLog.step('tenant_db:run:start', {
                index: i + 1,
                total: targetDbNames.length,
                dbName: tenantDbName
            });
            const result = await processTenantDb({
                dbName: tenantDbName,
                getClientDbConn,
                InterviewScheduleService,
                includeCoding,
                interviewerTypeArg,
                limit,
                dryRun,
                dbIndex: i + 1,
                dbTotal: targetDbNames.length,
            });
            rootLog.step('tenant_db:run:done', {
                index: i + 1,
                total: targetDbNames.length,
                dbName: tenantDbName,
                ok: result.ok,
                planned: result.planned,
                scanned: result.scanned,
                updated: result.updated,
                skipped: result.skipped,
                failed: result.failed
            });

            if (result.ok) totals.dbsSucceeded += 1;
            else totals.dbsFailed += 1;

            totals.planned += result.planned || 0;
            totals.scanned += result.scanned || 0;
            totals.updated += result.updated || 0;
            totals.skipped += result.skipped || 0;
            totals.failed += result.failed || 0;
        }

        rootLog.info(
            `action=summary dbs=${totals.dbs} dbsSucceeded=${totals.dbsSucceeded} dbsFailed=${totals.dbsFailed} planned=${totals.planned} scanned=${totals.scanned} updated=${totals.updated} skipped=${totals.skipped} failed=${totals.failed}`
        );
        rootLog.section('RUN END');
        process.exitCode = totals.failed > 0 || totals.dbsFailed > 0 ? 1 : 0;
    } catch (err) {
        rootLog.error(`action=fatal reason=${err?.message || err}`);
        rootLog.section('RUN END');
        process.exitCode = 1;
    } finally {
        try {
            await closeAllConnections();
        } catch (err) {
            rootLog.error(`action=close_error reason=${err?.message || err}`);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
