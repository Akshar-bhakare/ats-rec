import nodemailer from 'nodemailer';
import { getClientDbConn } from '../../../utils/clientDbUtils.js';
import { loadKeysConfigFromDB } from '../../../utils/dbUtils.js';

// class SMTPProvider {
//     constructor() {
//         this.transporter = nodemailer.createTransport({
//             host: process.env.SMTP_HOST,
//             port: process.env.SMTP_PORT,
//             secure: process.env.SMTP_SECURE === 'true',
//             auth: {
//                 user: process.env.SMTP_USER,
//                 pass: process.env.SMTP_PASS
//             }
//         });
//     }

//     async send({ to, subject, html, text, cc = undefined, bcc = "akash.shendage@hirexit.com" }) {
//         const mailOptions = {
//             from: process.env.SMTP_SENDER,
//             to,
//             cc,
//             bcc,
//             subject,
//             text,
//             html
//         };

//         return this.transporter.sendMail(mailOptions);
//     }
// }

// export default SMTPProvider;





const DEFAULT_SMTP_PORT = 587;

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

const parsePort = (value, fallback = DEFAULT_SMTP_PORT) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
};

const parseBool = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    const str = String(value ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(str)) return true;
    if (['false', '0', 'no', 'off'].includes(str)) return false;
    return fallback;
};

const EMAIL_SERVICE_PROVIDERS = ['SMTP', 'SendGrid', 'Amazon SES', 'Amazon SES', 'Mailgun'];

class SMTPProvider {
    async getActiveEmailSetting(reqContext = null) {
        const readByProviders = async (reqLike = null) => {
            for (const provider of EMAIL_SERVICE_PROVIDERS) {
                try {
                    const cfg = await loadKeysConfigFromDB('Email', provider, reqLike);
                    if (cfg?.configurationDetails) return cfg;
                } catch (err) {
                    console.warn(`[SMTPProvider] Failed loading "${provider}" config:`, err?.message || err);
                }
            }
            return null;
        };

        const normalizedReq =
            reqContext?.conn ? reqContext
                : reqContext?.req?.conn ? reqContext.req
                    : null;

        let cfg = null;
        try {
            cfg = await readByProviders(normalizedReq);
        } catch (err) {
            console.warn('[SMTPProvider] Failed to read tenant email settings:', err?.message || err);
        }

        if (!cfg) {
            try {
                const dbName = reqContext?.dbName || reqContext?.req?.dbName;
                if (dbName) {
                    const tenantConn = await getClientDbConn(dbName);
                    cfg = await readByProviders({ conn: tenantConn });
                }
            } catch (err) {
                console.warn('[SMTPProvider] Failed to read dbName email settings:', err?.message || err);
            }
        }

        if (!cfg) {
            try {
                cfg = await readByProviders(null);
            } catch (err) {
                console.warn('[SMTPProvider] Failed to read global email settings:', err?.message || err);
            }
        }

        return cfg?.configurationDetails || {};
    }

    resolveSmtpConfig(details = {}) {
        const host = firstPresent(
            readConfigValue(details, 'SMTP_HOST'),
            readConfigValue(details, 'smtpHost'),
            process.env.SMTP_HOST
        );
        const port = parsePort(
            firstPresent(
                readConfigValue(details, 'SMTP_PORT'),
                readConfigValue(details, 'smtpPort'),
                process.env.SMTP_PORT
            ),
            parsePort(process.env.SMTP_PORT, DEFAULT_SMTP_PORT)
        );
        const secure = parseBool(
            firstPresent(
                readConfigValue(details, 'SMTP_SECURE'),
                readConfigValue(details, 'smtpSecure'),
                process.env.SMTP_SECURE
            ),
            false
        );
        const user = firstPresent(
            readConfigValue(details, 'SMTP_USER'),
            readConfigValue(details, 'username'),
            process.env.SMTP_USER
        );
        const pass = firstPresent(
            readConfigValue(details, 'SMTP_PASS'),
            readConfigValue(details, 'password'),
            process.env.SMTP_PASS
        );
        const from = firstPresent(
            readConfigValue(details, 'SMTP_SENDER'),
            readConfigValue(details, 'smtpSender'),
            process.env.SMTP_SENDER
        );

        return { host, port, secure, user, pass, from };
    }

    async send({ to, subject, html, text, cc = undefined, bcc = "akash.shendage@hirexit.com", reqContext = null }) {
        const settingDetails = await this.getActiveEmailSetting(reqContext);
        const smtpConfig = this.resolveSmtpConfig(settingDetails);
        const transportOptions = {
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
        };
        if (smtpConfig.user || smtpConfig.pass) {
            transportOptions.auth = {
                user: smtpConfig.user,
                pass: smtpConfig.pass,
            };
        }

        const transporter = nodemailer.createTransport(transportOptions);
        const mailOptions = {
            from: smtpConfig.from,
            to,
            cc,
            bcc,
            subject,
            text,
            html
        };

        return transporter.sendMail(mailOptions);
    }
}

export default SMTPProvider;
