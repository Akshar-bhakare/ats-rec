/**
 * One-time script: sets CORS on the Firebase Storage bucket so that
 * the browser can fetch signed chunk URLs directly (needed for playback).
 *
 * Run once from the backend directory:
 *   node src/scripts/setStorageCors.js
 *
 * After running, you can delete this file.
 */
import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

// ── Initialise Firebase Admin (same as firebaseUtils.js) ───────────────────────
let credential = admin.credential.applicationDefault();
try {
    const json = JSON.parse(process.env.FIREBASE_CONFIG);
    credential = admin.credential.cert(json);
} catch (e) {
    console.warn('Could not parse FIREBASE_CONFIG JSON, using application default credentials');
}

const bucketName = process.env.FIREBASE_BUCKET
    || `${(() => { try { return JSON.parse(process.env.FIREBASE_CONFIG).project_id; } catch (_) { return ''; } })()}.firebasestorage.app`;

if (!admin.apps.length) {
    admin.initializeApp({ credential, storageBucket: bucketName });
}

const bucket = admin.storage().bucket();

// ── CORS rules ─────────────────────────────────────────────────────────────────
// Add every origin that will load the playback player.
// 'null' covers some sandboxed iframe environments during local dev.
const CORS_CONFIG = [
    {
        origin: [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:4173',
            // Add your production domain here, e.g. 'https://app.yourcompany.com'
        ],
        method: ['GET', 'HEAD'],
        responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Range', 'Accept-Ranges'],
        maxAgeSeconds: 3600,
    },
];

async function main() {
    try {
        console.log(`Setting CORS on bucket: ${bucket.name}`);
        await bucket.setCorsConfiguration(CORS_CONFIG);
        console.log('✅ CORS configuration applied successfully.');
        console.log('   Origins allowed:', CORS_CONFIG[0].origin.join(', '));
        console.log('   Methods:', CORS_CONFIG[0].method.join(', '));
        console.log('\nYou can verify with: gsutil cors get gs://' + bucket.name);
    } catch (err) {
        console.error('❌ Failed to set CORS:', err.message || err);
        process.exit(1);
    }
}

main();
