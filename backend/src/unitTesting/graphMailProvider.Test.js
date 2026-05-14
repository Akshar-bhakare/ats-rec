// HOW TO RUN:
//   node backend/src/unitTesting/graphMailProvider.Test.js

import fs from 'fs';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath, pathToFileURL } from 'url';

let PASS = 0;
let FAIL = 0;

function assert(condition, message = 'Assertion failed') {
    if (!condition) throw new Error(message);
}

async function test(name, fn) {
    try {
        await fn();
        PASS += 1;
        console.log(`[PASS] ${name}`);
    } catch (err) {
        FAIL += 1;
        console.error(`[FAIL] ${name}`);
        console.error('  ', err?.message || err);
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/graph_mail_provider_test';
process.env.DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME || 'graph_mail_provider_test';

const originalCreateConnection = mongoose.createConnection.bind(mongoose);
mongoose.createConnection = () => {
    const models = {};
    const conn = {
        models,
        model: (name, schema) => {
            if (!models[name]) models[name] = { schema };
            return models[name];
        },
        asPromise: async () => conn,
        on: () => conn,
        close: async () => { },
    };
    return conn;
};

const { default: GraphMailAuthClient } = await import('../services/eMailing/providers/graphMailAuthClient.js');
const { default: GraphMailProvider } = await import('../services/eMailing/providers/graphMailProvider.js');

await test('GraphMailAuthClient caches tokens', async () => {
    let callCount = 0;
    const client = new GraphMailAuthClient({
        config: {
            tenantId: 'tenant-id',
            clientId: 'client-id',
            clientSecret: 'secret',
            scope: 'https://graph.microsoft.com/.default',
        },
        httpClient: {
            post: async () => {
                callCount += 1;
                return {
                    data: {
                        access_token: 'token-123',
                        expires_in: 3600,
                    },
                };
            },
        },
    });

    const first = await client.getAccessToken();
    const second = await client.getAccessToken();

    assert(first === 'token-123', 'expected first token');
    assert(second === 'token-123', 'expected cached token');
    assert(callCount === 1, 'expected one token request');
});

await test('GraphMailProvider prefers DB config over env fallback', async () => {
    const provider = new GraphMailProvider({
        loadKeysConfig: async () => ({
            configurationDetails: {
                MS_GRAPH_MAIL_TENANT_ID: 'db-tenant',
                MS_GRAPH_MAIL_CLIENT_ID: 'db-client',
                MS_GRAPH_MAIL_CLIENT_SECRET: 'db-secret',
                MS_GRAPH_MAIL_SENDER: 'db@hirexit.com',
                MS_GRAPH_MAIL_SAVE_TO_SENT_ITEMS: 'false',
            },
        }),
        getClientDbConnection: async () => null,
        authClientFactory: () => ({
            getAccessToken: async () => 'graph-token',
        }),
        httpClient: {
            request: async () => ({ status: 202 }),
        },
    });

    process.env.MS_GRAPH_MAIL_TENANT_ID = 'env-tenant';
    process.env.MS_GRAPH_MAIL_CLIENT_ID = 'env-client';
    process.env.MS_GRAPH_MAIL_CLIENT_SECRET = 'env-secret';
    process.env.MS_GRAPH_MAIL_SENDER = 'env@hirexit.com';

    const details = await provider.getActiveGraphMailSetting();
    const config = provider.resolveGraphMailConfig(details);

    assert(config.tenantId === 'db-tenant', 'expected DB tenant ID');
    assert(config.clientId === 'db-client', 'expected DB client ID');
    assert(config.sender === 'db@hirexit.com', 'expected DB sender');
    assert(config.saveToSentItems === false, 'expected DB boolean override');
});

await test('GraphMailProvider maps subject, html, recipients, and saveToSentItems', async () => {
    let capturedRequest = null;
    const provider = new GraphMailProvider({
        loadKeysConfig: async () => ({
            configurationDetails: {
                MS_GRAPH_MAIL_TENANT_ID: 'tenant-id',
                MS_GRAPH_MAIL_CLIENT_ID: 'client-id',
                MS_GRAPH_MAIL_CLIENT_SECRET: 'secret',
                MS_GRAPH_MAIL_SENDER: 'sender@hirexit.com',
            },
        }),
        getClientDbConnection: async () => null,
        authClientFactory: () => ({
            getAccessToken: async () => 'graph-token',
        }),
        httpClient: {
            request: async (request) => {
                capturedRequest = request;
                return { status: 202 };
            },
        },
    });

    const response = await provider.send({
        to: 'one@test.com, Two <two@test.com>',
        cc: ['cc@test.com'],
        bcc: 'bcc@test.com',
        subject: 'Graph subject',
        html: '<p>Hello</p>',
        text: 'Hello',
    });

    assert(response.provider === 'graph', 'expected graph response');
    assert(capturedRequest.url.endsWith('/users/sender%40hirexit.com/sendMail'), 'expected sender mailbox endpoint');
    assert(capturedRequest.data.message.subject === 'Graph subject', 'expected subject');
    assert(capturedRequest.data.message.body.contentType === 'HTML', 'expected HTML body');
    assert(capturedRequest.data.message.toRecipients.length === 2, 'expected two to recipients');
    assert(capturedRequest.data.message.ccRecipients.length === 1, 'expected cc recipient');
    assert(capturedRequest.data.message.bccRecipients.length === 1, 'expected bcc recipient');
    assert(capturedRequest.data.saveToSentItems === true, 'expected default saveToSentItems');
});

const createPatchedEmailServiceModule = (dirSuffix) => {
    const testDir = path.join(os.tmpdir(), `${dirSuffix}_${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    const emailServicePath = path.resolve(__dirname, '../services/eMailing/emailService.js');
    const originalEmailService = fs.readFileSync(emailServicePath, 'utf8');

    fs.writeFileSync(path.join(testDir, 'mock_graphMailProvider.js'), `
export default class GraphMailProvider {
  async send(...args) { return globalThis.__GRAPH_MAIL_TEST_STATE.graphSend(...args); }
}
`.trim());

    fs.writeFileSync(path.join(testDir, 'mock_gmailProvider.js'), `
export default class GmailProvider {
  async send(...args) { return globalThis.__GRAPH_MAIL_TEST_STATE.gmailSend(...args); }
}
`.trim());

    fs.writeFileSync(path.join(testDir, 'mock_smtpProvider.js'), `
export default class SMTPProvider {
  async send(...args) { return globalThis.__GRAPH_MAIL_TEST_STATE.smtpSend(...args); }
}
`.trim());

    fs.writeFileSync(path.join(testDir, 'mock_clientDbUtils.js'), `
export async function getClientDbConn() {
  return { models: {} };
}
`.trim());

    fs.writeFileSync(path.join(testDir, 'mock_emailUnsubscribeUtils.js'), `
export function createEmailUnsubscribeToken() { return 'token'; }
export function getFrontendOriginForEmails() { return 'https://example.com'; }
`.trim());

    fs.writeFileSync(path.join(testDir, 'mock_mongoose.js'), `
export default {
  isValidObjectId() { return false; },
  Types: {
    ObjectId: class ObjectId {},
  },
};
`.trim());

    const patched = originalEmailService
        .replace("import mongoose from 'mongoose';", "import mongoose from './mock_mongoose.js';")
        .replace("import GraphMailProvider from './providers/graphMailProvider.js';", "import GraphMailProvider from './mock_graphMailProvider.js';")
        .replace("import GmailProvider from './providers/gmailProvider.js';", "import GmailProvider from './mock_gmailProvider.js';")
        .replace("import SMTPProvider from './providers/smtpProvider.js';", "import SMTPProvider from './mock_smtpProvider.js';")
        .replace("import { getClientDbConn } from '../../utils/clientDbUtils.js';", "import { getClientDbConn } from './mock_clientDbUtils.js';")
        .replace(
            /import \{\s*createEmailUnsubscribeToken,\s*getFrontendOriginForEmails,\s*\} from '\.\.\/\.\.\/utils\/emailUnsubscribeUtils\.js';/,
            "import { createEmailUnsubscribeToken, getFrontendOriginForEmails } from './mock_emailUnsubscribeUtils.js';"
        )
        .replace('const sendEmailThroughProviders = async (mailData, reqContext = null) => {', 'export const sendEmailThroughProviders = async (mailData, reqContext = null) => {');

    const patchedPath = path.join(testDir, 'emailService.patched.js');
    fs.writeFileSync(patchedPath, patched);
    return patchedPath;
};

await test('Email service provider order is Graph -> Gmail -> SMTP', async () => {
    const patchedPath = createPatchedEmailServiceModule('graph_mail_provider_test');
    const calls = [];

    globalThis.__GRAPH_MAIL_TEST_STATE = {
        graphSend: async () => {
            calls.push('graph');
            throw new Error('graph failed');
        },
        gmailSend: async () => {
            calls.push('gmail');
            throw new Error('gmail failed');
        },
        smtpSend: async () => {
            calls.push('smtp');
            return { status: 'sent' };
        },
    };

    const { sendEmailThroughProviders } = await import(pathToFileURL(patchedPath).href + `?v=${Date.now()}`);
    const result = await sendEmailThroughProviders({ to: 'test@example.com', subject: 'Subj' }, null);

    assert(result.provider === 'smtp', 'expected SMTP result after fallbacks');
    assert(calls.join('>') === 'graph>gmail>smtp', 'expected Graph -> Gmail -> SMTP order');
    delete globalThis.__GRAPH_MAIL_TEST_STATE;
});

await test('Email service stops after Graph success', async () => {
    const patchedPath = createPatchedEmailServiceModule('graph_mail_provider_success_test');
    const calls = [];

    globalThis.__GRAPH_MAIL_TEST_STATE = {
        graphSend: async () => {
            calls.push('graph');
            return { status: 'sent' };
        },
        gmailSend: async () => {
            calls.push('gmail');
            return { status: 'sent' };
        },
        smtpSend: async () => {
            calls.push('smtp');
            return { status: 'sent' };
        },
    };

    const { sendEmailThroughProviders } = await import(pathToFileURL(patchedPath).href + `?v=${Date.now()}`);
    const result = await sendEmailThroughProviders({ to: 'test@example.com', subject: 'Subj' }, null);

    assert(result.provider === 'graph', 'expected Graph result');
    assert(calls.join('>') === 'graph', 'expected only Graph to run');
    delete globalThis.__GRAPH_MAIL_TEST_STATE;
});

mongoose.createConnection = originalCreateConnection;

console.log(`\nDone. Passed: ${PASS}, Failed: ${FAIL}`);
process.exit(FAIL ? 1 : 0);
