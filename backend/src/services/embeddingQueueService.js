import mongoose from 'mongoose';
import { generateEmbedding } from '../utils/embeddingUtils.js';

const workQueue = [];
let processingQueue = false;

async function processQueue() {
    if (processingQueue) {
        return;
    }

    processingQueue = true;

    while (workQueue.length > 0) {
        const item = workQueue.shift();
        const { candidateId, reqLike, force } = item || {};
        const { conn, client, user } = reqLike || {};

        try {
            if (!conn || !client) {
                continue;
            }
            await processCandidateItem({ candidateId, conn, client, user, force });
        } catch (err) {
            console.error('[EmbeddingQueue] Error while processing item:', err);
        }
    }

    processingQueue = false;
}

async function processCandidateItem({ candidateId, conn, client, user, force }) {
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
        console.warn('[EmbeddingQueue.processCandidateItem] invalid candidateId:', candidateId);
        return;
    }

    const Candidate = conn.models['Candidate'];

    const cand = await Candidate.findOne({ _id: candidateId, client, isArchived: false }).lean();
    if (!cand) {
        console.warn('[EmbeddingQueue.processCandidateItem] Candidate not found or archived:', String(candidateId));
        return;
    }

    const hasEmbedding = Array.isArray(cand.embedding) && cand.embedding.length > 0;
    if (hasEmbedding && !force) {
        return;
    }

    const resumeText = typeof cand.resumeText === 'string'
        ? cand.resumeText
        : String(cand.resumeText || '');

    if (!resumeText.trim()) {
        console.warn('[EmbeddingQueue.processCandidateItem] Missing resumeText, skipping:', String(candidateId));
        return;
    }

    console.log('[EmbeddingQueue] Generating embedding for candidate:', String(candidateId));
    const embedding = await generateEmbedding(resumeText, { conn, client, user });
    if (!Array.isArray(embedding) || embedding.length === 0) {
        console.warn('[EmbeddingQueue.processCandidateItem] Embedding generation failed:', String(candidateId));
        return;
    }

    await Candidate.updateOne(
        { _id: candidateId, client },
        { $set: { embedding } }
    ).exec();
}

export function enqueueCandidateEmbedding(candidateId, reqLike, options = {}) {
    workQueue.push({ candidateId, reqLike, force: Boolean(options.force) });
    processQueue().catch(err => {
        console.error('[EmbeddingQueue.enqueueCandidateEmbedding] processQueue error:', err);
    });
}
