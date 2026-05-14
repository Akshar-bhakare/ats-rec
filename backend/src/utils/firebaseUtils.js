import path from 'path';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { tmpMediaDir } from '../../server.js';


dotenv.config();

let firbseCredential = admin.credential.applicationDefault();
let projectIdFromJson;
try {
    const json = JSON.parse(process.env.FIREBASE_CONFIG);
    firbseCredential = admin.credential.cert(json);
    projectIdFromJson = json.project_id;
} catch (err) {
    console.warn(`⚠️ Could not parse JSON for Firebase Admin:`, err);
}

// 3) adjust bucket suffix if needed
let bucketName = process.env.FIREBASE_BUCKET || `${projectIdFromJson}.firebasestorage.app`;

// 4) initialize once
if (!admin.apps.length) {
    admin.initializeApp({
        credential: firbseCredential,
        storageBucket: bucketName,
    });
}

const bucket = admin.storage().bucket();

function formatFirebaseError(error) {
    if (!error) return { message: 'Unknown Firebase error' };
    if (typeof error === 'string') return { message: error };
    return {
        message: error.message || String(error),
        code: error.code,
        status: error.status || error.statusCode,
    };
}

function assertNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`[Firebase] ${label} must be a non-empty string`);
    }
}

function assertNonEmptyBuffer(value, label) {
    if (!Buffer.isBuffer(value) || value.length === 0) {
        throw new Error(`[Firebase] ${label} must be a non-empty Buffer`);
    }
}

function assertContentType(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error('[Firebase] contentType must be a non-empty string');
    }
}

/**
 * Uploads a Buffer to Firebase Storage under the given remote path.
 * Returns the remotePath.
 */
export async function uploadBufferToFirebase(buffer, remotePath, contentType = 'application/octet-stream') {
    assertNonEmptyBuffer(buffer, 'buffer');
    assertNonEmptyString(remotePath, 'remotePath');
    assertContentType(contentType);
    try {
        const file = bucket.file(remotePath);
        await file.save(buffer, {
            metadata: { contentType },
            resumable: false,
        });
        return remotePath;
    } catch (error) {
        console.error('[Firebase] uploadBufferToFirebase failed:', {
            remotePath,
            contentType,
            error: formatFirebaseError(error),
        });
        throw error;
    }
}

/**
 * Generates a long-lived signed URL so you can verify upload immediately.
 */
export async function getDownloadURL(remotePath) {
    assertNonEmptyString(remotePath, 'remotePath');
    try {
        const file = bucket.file(remotePath);
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '2491-01-01',
        });
        return url;
    } catch (error) {
        console.error('[Firebase] getDownloadURL failed:', {
            remotePath,
            error: formatFirebaseError(error),
        });
        throw error;
    }
}

/**
 * Downloads a file from Firebase Storage into a local tmp folder.
 * Returns the local absolute path.
 */
export async function downloadFromFirebase(remotePath) {
    assertNonEmptyString(remotePath, 'remotePath');
    try {
        const localPath = path.join(tmpMediaDir, path.basename(remotePath));
        await bucket.file(remotePath).download({ destination: localPath });
        return localPath;
    } catch (error) {
        console.error('[Firebase] downloadFromFirebase failed:', {
            remotePath,
            error: formatFirebaseError(error),
        });
        throw error;
    }
}
