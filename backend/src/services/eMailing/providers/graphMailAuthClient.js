import axios from 'axios';

export const GRAPH_MAIL_AUTH_ERROR_CODES = Object.freeze({
    CONFIG_ERROR: 'GRAPH_MAIL_AUTH_CONFIG_ERROR',
    AUTH_ERROR: 'GRAPH_MAIL_AUTH_ERROR',
});

export class GraphMailAuthError extends Error {
    constructor({ code, message, statusCode = 503, details = null }) {
        super(message);
        this.name = 'GraphMailAuthError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

export function createGraphMailAuthError(code, message, statusCode = 503, details = null) {
    return new GraphMailAuthError({ code, message, statusCode, details });
}

export default class GraphMailAuthClient {
    constructor({ config, httpClient = axios }) {
        this.config = config || {};
        this.httpClient = httpClient;
        this.cachedToken = null;
        this.cachedTokenExpiresAt = 0;
    }

    async getAccessToken() {
        if (this.cachedToken && Date.now() < this.cachedTokenExpiresAt) {
            return this.cachedToken;
        }

        if (!this.config.tenantId || !this.config.clientId || !this.config.clientSecret) {
            throw createGraphMailAuthError(
                GRAPH_MAIL_AUTH_ERROR_CODES.CONFIG_ERROR,
                'Microsoft Graph mail credentials are not configured',
                503
            );
        }

        const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

        try {
            const response = await this.httpClient.post(
                tokenUrl,
                new URLSearchParams({
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    scope: this.config.scope,
                    grant_type: 'client_credentials',
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 15000,
                }
            );

            const expiresInMs = Math.max(30, Number(response?.data?.expires_in || 0) - 60) * 1000;
            this.cachedToken = response?.data?.access_token || null;
            this.cachedTokenExpiresAt = Date.now() + expiresInMs;

            if (!this.cachedToken) {
                throw new Error('Token response did not include access_token');
            }

            return this.cachedToken;
        } catch (error) {
            const status = Number(error?.response?.status || 0);
            const responseMessage =
                error?.response?.data?.error?.message ||
                error?.response?.data?.error_description ||
                error?.message ||
                'Microsoft Graph mail authentication failed';

            throw createGraphMailAuthError(
                status === 401 || status === 403
                    ? GRAPH_MAIL_AUTH_ERROR_CODES.AUTH_ERROR
                    : GRAPH_MAIL_AUTH_ERROR_CODES.CONFIG_ERROR,
                responseMessage,
                status === 401 || status === 403 ? status : 503,
                {
                    provider: 'microsoft_graph_mail',
                    status,
                }
            );
        }
    }
}
