#!/usr/bin/env node
'use strict';

// Candidate embedding backfill script
// - Connects to a single client DB (never ultraadmin) via --dbName/--mongoUri
// - Counts total + missing embeddings, then prompts before processing (use --yes to skip)
// - Scans candidates missing embeddings, generates vectors from resume text, updates embedding field
// - Supports batching, concurrency, retries, progress logs, and dry-run mode

const path = require('path');
const { pathToFileURL } = require('url');
const { createRequire } = require('module');
const readline = require('readline');

let mongoose;
try {
    mongoose = require('mongoose');
} catch (err) {
    try {
        const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
        mongoose = backendRequire('mongoose');
    } catch (fallbackErr) {
        console.error('Cannot find module "mongoose". Install deps in root or backend before running this script.');
        throw err;
    }
}

function loadDotenv() {
    const envPaths = [
        path.join(__dirname, '..', 'backend', '.env'),
        path.join(__dirname, '..', '.env')
    ];

    const tryLoad = dotenv => {
        for (const envPath of envPaths) {
            dotenv.config({ path: envPath, override: false });
        }
    };

    try {
        const dotenv = require('dotenv');
        tryLoad(dotenv);
        return;
    } catch {
        // ignore
    }

    try {
        const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
        const dotenv = backendRequire('dotenv');
        tryLoad(dotenv);
    } catch {
        // ignore
    }
}

loadDotenv();

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 400;

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const raw = argv[i];
        if (!raw || !raw.startsWith('--')) {
            continue;
        }
        const eqIndex = raw.indexOf('=');
        if (eqIndex !== -1) {
            const key = raw.slice(2, eqIndex);
            const value = raw.slice(eqIndex + 1);
            args[key] = value;
            continue;
        }
        const key = raw.slice(2);
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

function parseBool(value, defaultValue) {
    if (value === undefined) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    }
    return defaultValue;
}

function parseNumber(value, defaultValue) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
}

function askQuestion(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(prompt, answer => {
            rl.close();
            resolve(answer);
        });
    });
}

async function confirmProceed({
    log,
    dbName,
    plannedCount,
    totalCount,
    missingCount,
    onlyMissing,
    autoApprove
}) {
    if (autoApprove) {
        log.info(`action=confirm auto=true planned=${plannedCount}`);
        return true;
    }

    if (!process.stdin.isTTY) {
        log.warn('action=confirm skipped reason=non_tty use --yes to auto-approve');
        return false;
    }

    const scope = onlyMissing
        ? `missing embeddings (missing: ${missingCount}, total active: ${totalCount})`
        : `total active: ${totalCount}`;
    const prompt = `${new Date().toISOString()} [EMBED_BACKFILL][${dbName}] Proceed to process ${plannedCount} candidate${plannedCount === 1 ? '' : 's'} (${scope})? (yes/no): `;
    const answer = await askQuestion(prompt);
    const normalized = String(answer || '').trim().toLowerCase();
    const yes = normalized === 'y' || normalized === 'yes';
    log.info(`action=confirm response=${yes ? 'yes' : 'no'}`);
    return yes;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractDbNameFromMongoUri(uri) {
    if (!uri || typeof uri !== 'string') return null;
    try {
        const url = new URL(uri);
        const pathname = url.pathname || '';
        const dbName = pathname.replace(/^\/+/, '').split('/')[0];
        return dbName || null;
    } catch {
        const match = uri.match(/\/([^/?]+)(\?|$)/);
        return match ? match[1] : null;
    }
}

function isEmbeddingMissing(candidate) {
    const embedding = candidate?.embedding;
    if (!Array.isArray(embedding)) {
        if (embedding == null) return true;
        return true;
    }
    if (embedding.length === 0) return true;

    if (candidate?.embeddingGenerated === false) return true;

    const meta = candidate?.embeddingMeta || candidate?.embedding_meta;
    if (meta && (meta.generated === false || meta.isGenerated === false || meta.status === 'not_generated')) {
        return true;
    }
    return false;
}

function pickResumeText(candidate) {
    const candidates = [
        candidate?.resumeText,
        candidate?.parsedResumeText,
        candidate?.resumeParsed,
        candidate?.resumeParsed?.text,
        candidate?.resumeJson?.text,
        candidate?.resumeJson?.parsedText,
        candidate?.resumeJson?.data?.text,
        candidate?.resume?.text
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function isTransientError(err) {
    const message = String(err?.message || '');
    const code = err?.code;
    const status = err?.status;

    if (typeof code === 'number') {
        const transientCodes = new Set([
            6, 7, 89, 91, 189, 262, 9001, 10107, 11600, 11602, 13435, 13436
        ]);
        if (transientCodes.has(code)) return true;
    }

    if (status && [429, 500, 502, 503, 504].includes(status)) return true;

    if (err?.name && [
        'MongoNetworkError',
        'MongoServerSelectionError',
        'MongoWriteConcernError',
        'MongoTopologyClosedError'
    ].includes(err.name)) {
        return true;
    }

    if (/ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|socket hang up|timed out|timeout|rate limit|429|503|502|504/i.test(message)) {
        return true;
    }

    return false;
}

async function withRetries(fn, retries, backoffMs, shouldRetry, onRetry) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            if (attempt >= retries || !shouldRetry(err)) {
                throw err;
            }
            const delay = backoffMs * Math.pow(2, attempt);
            attempt += 1;
            if (typeof onRetry === 'function') {
                onRetry(err, attempt, delay);
            }
            await sleep(delay);
        }
    }
}

async function generateEmbeddingWithRetry(generateEmbedding, text, reqLike, retries, backoffMs, onRetry) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const vector = await generateEmbedding(text, reqLike);
        if (Array.isArray(vector) && vector.length > 0) {
            return vector;
        }
        if (attempt < retries) {
            const delay = backoffMs * Math.pow(2, attempt);
            if (typeof onRetry === 'function') {
                onRetry(attempt + 1, delay);
            }
            await sleep(delay);
        }
    }
    return null;
}

async function runWithConcurrency(items, concurrency, handler) {
    let index = 0;
    const workers = new Array(concurrency).fill(null).map(async () => {
        while (true) {
            const current = index;
            index += 1;
            if (current >= items.length) break;
            await handler(items[current]);
        }
    });
    await Promise.all(workers);
}

function createLogger(dbName) {
    const prefix = `[EMBED_BACKFILL][${dbName}]`;
    const write = (method, message, meta) => {
        const timestamp = new Date().toISOString();
        const base = `${timestamp} ${prefix} ${message}`;
        if (meta && Object.keys(meta).length > 0) {
            console[method](base, meta);
        } else {
            console[method](base);
        }
    };
    return {
        info: (message, meta) => write('log', message, meta),
        warn: (message, meta) => write('warn', message, meta),
        error: (message, meta) => write('error', message, meta)
    };
}

function buildMissingFilter() {
    return {
        $or: [
            { embedding: { $exists: false } },
            { embedding: null },
            { embedding: { $size: 0 } },
            { embeddingGenerated: false },
            { 'embeddingMeta.generated': false },
            { 'embeddingMeta.isGenerated': false },
            { 'embeddingMeta.status': 'not_generated' }
        ]
    };
}

async function closeAllConnections() {
    const conns = mongoose.connections || [];
    await Promise.allSettled(conns.map(conn => conn.close()));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const dryRun = parseBool(args.dryRun, false);
    const onlyMissing = parseBool(args.onlyMissing, true);
    const autoApprove = parseBool(args.yes !== undefined ? args.yes : args.autoApprove, false);
    const limit = parseNumber(args.limit, null);
    const batchSize = Math.max(1, Math.floor(parseNumber(args.batchSize, DEFAULT_BATCH_SIZE)));
    const concurrency = Math.max(1, Math.floor(parseNumber(args.concurrency, DEFAULT_CONCURRENCY)));
    const resumeFromId = args.resumeFromId ? String(args.resumeFromId) : null;

    const mongoUriArg = args.mongoUri ? String(args.mongoUri) : null;
    let dbName = args.dbName ? String(args.dbName) : null;

    if (mongoUriArg) {
        const dbFromUri = extractDbNameFromMongoUri(mongoUriArg);
        if (!dbFromUri) {
            console.error('Missing database name in --mongoUri');
            process.exitCode = 1;
            return;
        }
        if (dbName && dbName !== dbFromUri) {
            console.error(`--dbName (${dbName}) does not match db in --mongoUri (${dbFromUri})`);
            process.exitCode = 1;
            return;
        }
        dbName = dbFromUri;
    }

    if (!dbName) {
        console.error('Missing required --dbName or --mongoUri with database name');
        process.exitCode = 1;
        return;
    }

    if (dbName.toLowerCase() === 'aiselektdev') {
        console.error('Refusing to run against ultraadmin DB (AiSelektDev)');
        process.exitCode = 1;
        return;
    }

    const envMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const mongoUri = mongoUriArg || envMongoUri;

    if (!mongoUri) {
        console.error('Missing MONGODB_URI env or --mongoUri');
        process.exitCode = 1;
        return;
    }

    if (resumeFromId && !mongoose.Types.ObjectId.isValid(resumeFromId)) {
        console.error(`Invalid --resumeFromId: ${resumeFromId}`);
        process.exitCode = 1;
        return;
    }

    process.env.MONGODB_URI = mongoUri;
    if (!process.env.MONGO_URI) {
        process.env.MONGO_URI = mongoUri;
    }
    process.env.DEFAULT_DB_NAME = dbName;

    const log = createLogger(dbName);
    const repoRoot = path.resolve(__dirname, '..');
    const clientDbUtilsUrl = pathToFileURL(path.join(repoRoot, 'backend/src/utils/clientDbUtils.js')).href;
    const embeddingUtilsUrl = pathToFileURL(path.join(repoRoot, 'backend/src/utils/embeddingUtils.js')).href;

    let conn;
    try {
        const { getClientDbConn } = await import(clientDbUtilsUrl);
        const { generateEmbedding } = await import(embeddingUtilsUrl);

        log.info(`action=start dryRun=${dryRun} onlyMissing=${onlyMissing} limit=${limit ?? 'none'} batchSize=${batchSize} concurrency=${concurrency} resumeFromId=${resumeFromId || 'none'}`);

        conn = await getClientDbConn(dbName);
        const Candidate = conn.models['Candidate'];
        if (!Candidate) {
            throw new Error('Candidate model not registered on connection');
        }

        const totalCount = await Candidate.countDocuments({ isArchived: false });
        const missingFilter = {
            isArchived: false,
            ...buildMissingFilter()
        };
        if (resumeFromId) {
            missingFilter._id = { $gt: new mongoose.Types.ObjectId(resumeFromId) };
        }
        const missingCount = await Candidate.countDocuments(missingFilter);
        const baseCount = onlyMissing ? missingCount : totalCount;
        const plannedCount = limit !== null ? Math.min(baseCount, limit) : baseCount;
        log.info(`action=preflight_config db=${dbName} dryRun=${dryRun} onlyMissing=${onlyMissing} limit=${limit ?? 'none'} batchSize=${batchSize} concurrency=${concurrency} resumeFromId=${resumeFromId || 'none'}`);
        log.info(`action=preflight_counts total=${totalCount} missing=${missingCount} planned=${plannedCount}`);

        if (plannedCount === 0) {
            log.info('action=done reason=zero_candidates');
            process.exitCode = 0;
            return;
        }

        const shouldProceed = await confirmProceed({
            log,
            dbName,
            plannedCount,
            totalCount,
            missingCount,
            onlyMissing,
            autoApprove
        });
        if (!shouldProceed) {
            log.info('action=cancelled');
            process.exitCode = 0;
            return;
        }

        const metrics = {
            scanned: 0,
            missing: 0,
            generated: 0,
            updated: 0,
            skippedNoText: 0,
            failed: 0
        };

        const baseFilter = { isArchived: false };
        if (onlyMissing) {
            Object.assign(baseFilter, buildMissingFilter());
        }

        let remaining = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : null;
        let lastId = resumeFromId ? new mongoose.Types.ObjectId(resumeFromId) : null;
        let batchIndex = 0;

        while (true) {
            if (remaining !== null && remaining <= 0) break;

            const batchLimit = remaining !== null ? Math.min(batchSize, remaining) : batchSize;
            const filter = { ...baseFilter };
            if (lastId) {
                filter._id = { $gt: lastId };
            }

            const candidates = await Candidate.find(filter)
                .sort({ _id: 1 })
                .limit(batchLimit)
                .select({
                    _id: 1,
                    resumeText: 1,
                    parsedResumeText: 1,
                    resumeParsed: 1,
                    resumeJson: 1,
                    embedding: 1,
                    embeddingMeta: 1,
                    embedding_meta: 1,
                    embeddingGenerated: 1,
                    client: 1,
                    isArchived: 1
                })
                .lean()
                .exec();

            if (!candidates.length) break;

            batchIndex += 1;
            log.info(`action=batch_start index=${batchIndex} size=${candidates.length} lastId=${lastId || 'none'}`);

            await runWithConcurrency(candidates, concurrency, async candidate => {
                const candidateId = String(candidate?._id || '');
                metrics.scanned += 1;

                const missing = isEmbeddingMissing(candidate);
                if (missing) {
                    metrics.missing += 1;
                } else if (onlyMissing) {
                    log.info(`candidateId=${candidateId} action=skip reason=embedding_present`);
                    return;
                }

                const resumeText = pickResumeText(candidate);
                if (!resumeText) {
                    metrics.skippedNoText += 1;
                    log.warn(`candidateId=${candidateId} action=skip reason=no_resume_text`);
                    return;
                }

                const reqLike = { conn, client: candidate?.client || null, user: null };
                const embedding = await generateEmbeddingWithRetry(
                    generateEmbedding,
                    resumeText,
                    reqLike,
                    DEFAULT_RETRIES,
                    DEFAULT_BACKOFF_MS,
                    (attempt, delay) => {
                        log.warn(`candidateId=${candidateId} action=retry stage=embedding attempt=${attempt} backoffMs=${delay}`);
                    }
                );

                if (!Array.isArray(embedding) || embedding.length === 0) {
                    metrics.failed += 1;
                    log.error(`candidateId=${candidateId} action=error stage=embedding message=embedding_generation_failed`);
                    return;
                }

                metrics.generated += 1;

                if (dryRun) {
                    log.info(`candidateId=${candidateId} action=dry_run_update embeddingLength=${embedding.length}`);
                    return;
                }

                const updateFilter = { _id: candidate._id };
                if (candidate?.client) {
                    updateFilter.client = candidate.client;
                }

                try {
                    const result = await withRetries(
                        () => Candidate.updateOne(updateFilter, { $set: { embedding } }).exec(),
                        DEFAULT_RETRIES,
                        DEFAULT_BACKOFF_MS,
                        isTransientError,
                        (err, attempt, delay) => {
                            log.warn(`candidateId=${candidateId} action=retry stage=update attempt=${attempt} backoffMs=${delay} error=${err?.message || err}`);
                        }
                    );

                    if (result?.modifiedCount > 0 || result?.matchedCount > 0) {
                        metrics.updated += 1;
                        log.info(`candidateId=${candidateId} action=update embeddingLength=${embedding.length}`);
                    } else {
                        metrics.failed += 1;
                        log.error(`candidateId=${candidateId} action=error stage=update message=no_documents_updated`);
                    }
                } catch (err) {
                    metrics.failed += 1;
                    log.error(`candidateId=${candidateId} action=error stage=update message=${err?.message || err}`);
                }
            });

            lastId = candidates[candidates.length - 1]._id;
            if (remaining !== null) {
                remaining -= candidates.length;
            }

            log.info(`action=progress scanned=${metrics.scanned} missing=${metrics.missing} generated=${metrics.generated} updated=${metrics.updated} skippedNoText=${metrics.skippedNoText} failed=${metrics.failed}`);
        }

        log.info(`action=summary scanned=${metrics.scanned} missing=${metrics.missing} generated=${metrics.generated} updated=${metrics.updated} skippedNoText=${metrics.skippedNoText} failed=${metrics.failed}`);

        process.exitCode = metrics.failed > 0 ? 1 : 0;
    } catch (err) {
        log.error(`action=fatal message=${err?.message || err}`);
        process.exitCode = 1;
    } finally {
        try {
            await closeAllConnections();
        } catch (err) {
            log.error(`action=close_error message=${err?.message || err}`);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
