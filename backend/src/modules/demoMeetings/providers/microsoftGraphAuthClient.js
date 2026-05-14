import axios from 'axios';
import { ErrorCodes, createDemoMeetingError } from '../utils/demoMeetingErrors.js';

export default class MicrosoftGraphAuthClient {
    constructor({ config, httpClient = axios }) {
        this.config = config;
        this.httpClient = httpClient;
        this.cachedToken = null;
        this.cachedTokenExpiresAt = 0;
    }

    async getAccessToken() {
        if (this.cachedToken && Date.now() < this.cachedTokenExpiresAt) {
            return this.cachedToken;
        }

        if (this.config.permissionMode !== 'application') {
            throw createDemoMeetingError(
                ErrorCodes.PROVIDER_CONFIG_ERROR,
                `Unsupported Microsoft Graph permission mode: ${this.config.permissionMode}`,
                503
            );
        }

        if (!this.config.tenantId || !this.config.clientId || !this.config.clientSecret) {
            throw createDemoMeetingError(
                ErrorCodes.PROVIDER_CONFIG_ERROR,
                'Microsoft Graph credentials are not configured',
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
                error?.response?.data?.error_description ||
                error?.response?.data?.error?.message ||
                error?.message ||
                'Microsoft Graph authentication failed';

            throw createDemoMeetingError(
                status === 401 || status === 403
                    ? ErrorCodes.PROVIDER_AUTH_ERROR
                    : ErrorCodes.PROVIDER_CONFIG_ERROR,
                responseMessage,
                status === 401 || status === 403 ? status : 503,
                {
                    provider: 'microsoft_graph',
                    status,
                }
            );
        }
    }
}

