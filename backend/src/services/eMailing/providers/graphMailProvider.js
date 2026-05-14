import axios from 'axios';

import { getClientDbConn } from '../../../utils/clientDbUtils.js';
import { loadKeysConfigFromDB } from '../../../utils/dbUtils.js';
import GraphMailAuthClient from './graphMailAuthClient.js';

const GRAPH_MAIL_PROVIDER_NAME = 'Microsoft Graph Mail';
const DEFAULT_GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const DEFAULT_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

const isPresent = (value) => (
    value !== undefined &&
    value !== null &&
    !(typeof value === 'string' && value.trim() === '')
);

const firstPresent = (...values) => values.find(isPresent);

const readConfigValue = (details, key) => {
    if (!details) return undefined;
    if (typeof details.get === 'function') return details.get(key);
    return details[key];
};

const parseBool = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    const str = String(value ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(str)) return true;
    if (['false', '0', 'no', 'off'].includes(str)) return false;
    return fallback;
};

const normalizeRecipientToken = (raw = '') => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';

    const angleMatch = trimmed.match(/<([^>]+)>/);
    const candidate = angleMatch ? angleMatch[1] : trimmed;
    const basicEmailMatch = candidate.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    return basicEmailMatch ? basicEmailMatch[0].toLowerCase() : '';
};

const normalizeRecipientList = (input) => {
    if (!input) return [];

    const values = Array.isArray(input)
        ? input
        : String(input)
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);

    return Array.from(new Set(values.map((value) => normalizeRecipientToken(value)).filter(Boolean)));
};

const toRecipientObjects = (input) =>
    normalizeRecipientList(input).map((address) => ({
        emailAddress: { address },
    }));

export default class GraphMailProvider {
    constructor({
        httpClient = axios,
        authClientFactory = (options) => new GraphMailAuthClient(options),
        loadKeysConfig = loadKeysConfigFromDB,
        getClientDbConnection = getClientDbConn,
        logger = console,
    } = {}) {
        this.httpClient = httpClient;
        this.authClientFactory = authClientFactory;
        this.loadKeysConfig = loadKeysConfig;
        this.getClientDbConnection = getClientDbConnection;
        this.logger = logger;
        this.authClients = new Map();
    }

    async getActiveGraphMailSetting(reqContext = null) {
        const normalizedReq =
            reqContext?.conn ? reqContext
                : reqContext?.req?.conn ? reqContext.req
                    : null;

        let cfg = null;
        try {
            cfg = await this.loadKeysConfig('Email', GRAPH_MAIL_PROVIDER_NAME, normalizedReq);
        } catch (err) {
            this.logger.warn('[GraphMailProvider] Failed to read tenant Graph mail settings:', err?.message || err);
        }

        if (!cfg) {
            try {
                const dbName = reqContext?.dbName || reqContext?.req?.dbName;
                if (dbName) {
                    const tenantConn = await this.getClientDbConnection(dbName);
                    cfg = await this.loadKeysConfig('Email', GRAPH_MAIL_PROVIDER_NAME, { conn: tenantConn });
                }
            } catch (err) {
                this.logger.warn('[GraphMailProvider] Failed to read dbName Graph mail settings:', err?.message || err);
            }
        }

        if (!cfg) {
            try {
                cfg = await this.loadKeysConfig('Email', GRAPH_MAIL_PROVIDER_NAME, null);
            } catch (err) {
                this.logger.warn('[GraphMailProvider] Failed to read global Graph mail settings:', err?.message || err);
            }
        }

        return cfg?.configurationDetails || {};
    }

    resolveGraphMailConfig(details = {}) {
        const sender = firstPresent(
            readConfigValue(details, 'MS_GRAPH_MAIL_SENDER'),
            readConfigValue(details, 'msGraphMailSender'),
            process.env.MS_GRAPH_MAIL_SENDER
        );
        const saveToSentItems = parseBool(
            firstPresent(
                readConfigValue(details, 'MS_GRAPH_MAIL_SAVE_TO_SENT_ITEMS'),
                readConfigValue(details, 'msGraphMailSaveToSentItems'),
                process.env.MS_GRAPH_MAIL_SAVE_TO_SENT_ITEMS
            ),
            true
        );

        return {
            tenantId: firstPresent(
                readConfigValue(details, 'MS_GRAPH_MAIL_TENANT_ID'),
                readConfigValue(details, 'msGraphMailTenantId'),
                process.env.MS_GRAPH_MAIL_TENANT_ID
            ),
            clientId: firstPresent(
                readConfigValue(details, 'MS_GRAPH_MAIL_CLIENT_ID'),
                readConfigValue(details, 'msGraphMailClientId'),
                process.env.MS_GRAPH_MAIL_CLIENT_ID
            ),
            clientSecret: firstPresent(
                readConfigValue(details, 'MS_GRAPH_MAIL_CLIENT_SECRET'),
                readConfigValue(details, 'msGraphMailClientSecret'),
                process.env.MS_GRAPH_MAIL_CLIENT_SECRET
            ),
            scope: firstPresent(
                readConfigValue(details, 'MS_GRAPH_MAIL_SCOPE'),
                readConfigValue(details, 'msGraphMailScope'),
                process.env.MS_GRAPH_MAIL_SCOPE,
                DEFAULT_GRAPH_SCOPE
            ),
            sender: String(sender || '').trim(),
            saveToSentItems,
            baseUrl: DEFAULT_GRAPH_BASE_URL,
        };
    }

    validateConfig(config) {
        const missing = [];
        if (!config.tenantId) missing.push('MS_GRAPH_MAIL_TENANT_ID');
        if (!config.clientId) missing.push('MS_GRAPH_MAIL_CLIENT_ID');
        if (!config.clientSecret) missing.push('MS_GRAPH_MAIL_CLIENT_SECRET');
        if (!config.sender) missing.push('MS_GRAPH_MAIL_SENDER');

        if (missing.length) {
            const error = new Error(`Microsoft Graph mail configuration is incomplete: missing ${missing.join(', ')}`);
            error.name = 'GraphMailConfigError';
            error.code = 'GRAPH_MAIL_CONFIG_ERROR';
            error.details = { missing };
            throw error;
        }
    }

    getAuthClient(config) {
        const key = [config.tenantId, config.clientId, config.scope, config.sender].join('::');
        if (!this.authClients.has(key)) {
            this.authClients.set(
                key,
                this.authClientFactory({
                    config: {
                        tenantId: config.tenantId,
                        clientId: config.clientId,
                        clientSecret: config.clientSecret,
                        scope: config.scope,
                    },
                })
            );
        }
        return this.authClients.get(key);
    }

    createMessagePayload({ subject, html, text, to, cc, bcc }) {
        const toRecipients = toRecipientObjects(to);
        if (!toRecipients.length) {
            const error = new Error('EMAIL_NOT_FOUND_OR_INVALID');
            error.name = 'EmailNotFound';
            throw error;
        }

        const message = {
            subject: String(subject || '').trim(),
            body: {
                contentType: html ? 'HTML' : 'Text',
                content: html || text || '',
            },
            toRecipients,
        };

        const ccRecipients = toRecipientObjects(cc);
        const bccRecipients = toRecipientObjects(bcc);
        if (ccRecipients.length) message.ccRecipients = ccRecipients;
        if (bccRecipients.length) message.bccRecipients = bccRecipients;

        return message;
    }

    async send({ to, subject, html, text, cc = undefined, bcc = "akash.shendage@hirexit.com", reqContext = null }) {
        const settingDetails = await this.getActiveGraphMailSetting(reqContext);
        const config = this.resolveGraphMailConfig(settingDetails);
        this.validateConfig(config);

        const authClient = this.getAuthClient(config);
        const accessToken = await authClient.getAccessToken();
        const url = `${config.baseUrl}/users/${encodeURIComponent(config.sender)}/sendMail`;
        const payload = {
            message: this.createMessagePayload({ to, cc, bcc, subject, html, text }),
            saveToSentItems: config.saveToSentItems,
        };

        try {
            const response = await this.httpClient.request({
                method: 'POST',
                url,
                data: payload,
                timeout: 20000,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            return {
                provider: 'graph',
                status: 'sent',
                statusCode: Number(response?.status || 202),
            };
        } catch (error) {
            const status = Number(error?.response?.status || 0);
            const message =
                error?.response?.data?.error?.message ||
                error?.response?.data?.error_description ||
                error?.message ||
                'Microsoft Graph mail send failed';

            const sendError = new Error(message);
            sendError.name = status === 401 || status === 403 ? 'GraphMailAuthError' : 'GraphMailSendError';
            sendError.code = status === 401 || status === 403 ? 'GRAPH_MAIL_AUTH_ERROR' : 'GRAPH_MAIL_SEND_ERROR';
            sendError.statusCode = status || 502;
            sendError.details = {
                provider: 'microsoft_graph_mail',
                sender: config.sender,
                status,
            };
            throw sendError;
        }
    }
}
