/**
 * Storage Adapter - Abstraction layer for Firebase and GCS storage
 * 
 * This adapter provides a unified interface for storage operations,
 * allowing seamless switching between Firebase Storage and GCS Emulator
 * without changing the underlying business logic.
 */

import { Storage } from '@google-cloud/storage';
import admin from 'firebase-admin';
import path from 'path';
import { tmpMediaDir } from '../../server.js';

/**
 * Firebase Storage Adapter
 * Uses the existing firebase-admin SDK
 */
class FirebaseStorageAdapter {
    constructor(bucket) {
        this.bucket = bucket;
    }

    /**
     * Upload a buffer to storage
     * @param {Buffer} buffer - File buffer to upload
     * @param {string} remotePath - Remote path in storage
     * @param {string} contentType - MIME type
     * @returns {Promise<string>} - Remote path of uploaded file
     */
    async uploadBuffer(buffer, remotePath, contentType = 'application/octet-stream') {
        const file = this.bucket.file(remotePath);
        await file.save(buffer, {
            metadata: { contentType },
            resumable: false,
        });
        return remotePath;
    }

    /**
     * Get a signed download URL for a file
     * @param {string} remotePath - Remote path in storage
     * @returns {Promise<string>} - Signed URL
     */
    async getDownloadURL(remotePath) {
        const file = this.bucket.file(remotePath);
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '2491-01-01',
        });
        return url;
    }

    /**
     * Download a file from storage to local disk
     * @param {string} remotePath - Remote path in storage
     * @returns {Promise<string>} - Local file path
     */
    async downloadFile(remotePath) {
        const localPath = path.join(tmpMediaDir, path.basename(remotePath));
        await this.bucket.file(remotePath).download({ destination: localPath });
        return localPath;
    }

    /**
     * List files with a given prefix
     * @param {string} prefix - Prefix to filter files
     * @returns {Promise<Array>} - Array of file objects with name and metadata
     */
    async listFiles(prefix) {
        const [files] = await this.bucket.getFiles({ prefix });
        return files.map(file => ({
            name: file.name,
            metadata: file.metadata,
            file: file // Keep reference for downloading
        }));
    }

    /**
     * Delete files with a given prefix
     * @param {string} prefix - Prefix to filter files
     * @returns {Promise<{total: number, deleted: number, failed: number}>}
     */
    async deleteFilesByPrefix(prefix) {
        const [files] = await this.bucket.getFiles({ prefix });
        if (!files.length) {
            return { total: 0, deleted: 0, failed: 0 };
        }

        const results = await Promise.allSettled(files.map(file => file.delete()));
        const deleted = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - deleted;

        if (failed > 0) {
            console.warn(`[Storage Adapter] Failed to delete ${failed} files for prefix: ${prefix}`);
        }

        return { total: files.length, deleted, failed };
    }
}

/**
 * GCS Emulator Adapter
 * Uses @google-cloud/storage with custom endpoint for local development
 */
class GCSEmulatorAdapter {
    constructor(bucketName, projectId, emulatorEndpoint) {
        // Configure storage client to use emulator
        const storage = new Storage({
            projectId: projectId,
            apiEndpoint: emulatorEndpoint,
            // Disable auth for local emulator
            credentials: {
                client_email: 'test@example.com',
                private_key: 'fake-key'
            }
        });

        this.bucket = storage.bucket(bucketName);
        this.bucketName = bucketName;
    }

    /**
     * Upload a buffer to storage
     * @param {Buffer} buffer - File buffer to upload
     * @param {string} remotePath - Remote path in storage
     * @param {string} contentType - MIME type
     * @returns {Promise<string>} - Remote path of uploaded file
     */
    async uploadBuffer(buffer, remotePath, contentType = 'application/octet-stream') {
        const file = this.bucket.file(remotePath);
        await file.save(buffer, {
            metadata: { contentType },
            resumable: false,
        });
        return remotePath;
    }

    /**
     * Get a download URL for a file
     * For emulator, we construct the storage API download URL
     * @param {string} remotePath - Remote path in storage
     * @returns {Promise<string>} - Download URL
     */
    async getDownloadURL(remotePath) {
        // For GCS emulator, use the storage API format
        const emulatorEndpoint = process.env.GCS_EMULATOR_ENDPOINT || 'http://localhost:4443';
        // URL encode the path
        const encodedPath = encodeURIComponent(remotePath);
        const url = `${emulatorEndpoint}/download/storage/v1/b/${this.bucketName}/o/${encodedPath}?alt=media`;
        return url;
    }

    /**
     * Download a file from storage to local disk
     * @param {string} remotePath - Remote path in storage
     * @returns {Promise<string>} - Local file path
     */
    async downloadFile(remotePath) {
        const localPath = path.join(tmpMediaDir, path.basename(remotePath));
        await this.bucket.file(remotePath).download({ destination: localPath });
        return localPath;
    }

    /**
     * List files with a given prefix
     * @param {string} prefix - Prefix to filter files
     * @returns {Promise<Array>} - Array of file objects with name and metadata
     */
    async listFiles(prefix) {
        const [files] = await this.bucket.getFiles({ prefix });
        return files.map(file => ({
            name: file.name,
            metadata: file.metadata,
            file: file // Keep reference for downloading
        }));
    }

    /**
     * Delete files with a given prefix
     * @param {string} prefix - Prefix to filter files
     * @returns {Promise<{total: number, deleted: number, failed: number}>}
     */
    async deleteFilesByPrefix(prefix) {
        const [files] = await this.bucket.getFiles({ prefix });
        if (!files.length) {
            return { total: 0, deleted: 0, failed: 0 };
        }

        const results = await Promise.allSettled(files.map(file => file.delete()));
        const deleted = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - deleted;

        if (failed > 0) {
            console.warn(`[Storage Adapter] Failed to delete ${failed} files for prefix: ${prefix}`);
        }

        return { total: files.length, deleted, failed };
    }
}

/**
 * Initialize and export the appropriate storage adapter based on configuration
 */
function createStorageAdapter() {
    const storageMode = process.env.STORAGE_MODE || 'firebase';

    console.log(`[Storage Adapter] Initializing in ${storageMode.toUpperCase()} mode`);

    if (storageMode === 'gcs-emulator') {
        // GCS Emulator configuration
        const bucketName = process.env.GCS_BUCKET || 'local-recordings-bucket';
        const projectId = process.env.GCS_PROJECT_ID || 'local-dev-project';
        const emulatorEndpoint = process.env.GCS_EMULATOR_ENDPOINT || 'http://localhost:4443';

        console.log(`[Storage Adapter] GCS Emulator: ${emulatorEndpoint}, Bucket: ${bucketName}`);

        return new GCSEmulatorAdapter(bucketName, projectId, emulatorEndpoint);
    } else {
        // Firebase Storage (default)
        // Use the existing firebase admin bucket
        const bucket = admin.storage().bucket();

        console.log(`[Storage Adapter] Firebase Storage: ${bucket.name}`);

        return new FirebaseStorageAdapter(bucket);
    }
}

// Create and export a single instance
const storageAdapter = createStorageAdapter();

/**
 * Upload a buffer to storage
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} remotePath - Remote path in storage
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - Remote path of uploaded file
 */
export async function uploadBuffer(buffer, remotePath, contentType = 'application/octet-stream') {
    return await storageAdapter.uploadBuffer(buffer, remotePath, contentType);
}

/**
 * Get a download URL for a file
 * @param {string} remotePath - Remote path in storage
 * @returns {Promise<string>} - Download URL
 */
export async function getDownloadURL(remotePath) {
    return await storageAdapter.getDownloadURL(remotePath);
}

/**
 * Download a file from storage to local disk
 * @param {string} remotePath - Remote path in storage
 * @returns {Promise<string>} - Local file path
 */
export async function downloadFile(remotePath) {
    return await storageAdapter.downloadFile(remotePath);
}

/**
 * List files with a given prefix
 * @param {string} prefix - Prefix to filter files
 * @returns {Promise<Array>} - Array of file objects
 */
export async function listFiles(prefix) {
    return await storageAdapter.listFiles(prefix);
}

/**
 * Delete files with a given prefix
 * @param {string} prefix - Prefix to filter files
 * @returns {Promise<{total: number, deleted: number, failed: number}>}
 */
export async function deleteFilesByPrefix(prefix) {
    return await storageAdapter.deleteFilesByPrefix(prefix);
}

// For backwards compatibility, also export the old function name
export const uploadBufferToFirebase = uploadBuffer;

export default storageAdapter;
