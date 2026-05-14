import mongoose from 'mongoose';
import GraphMailProvider from './providers/graphMailProvider.js';
import GmailProvider from './providers/gmailProvider.js';
import SMTPProvider from './providers/smtpProvider.js';
import { getClientDbConn } from '../../utils/clientDbUtils.js';
import {
    createEmailUnsubscribeToken,
    getFrontendOriginForEmails,
} from '../../utils/emailUnsubscribeUtils.js';

const graphMailProvider = new GraphMailProvider();
const gmailProvider = new GmailProvider();
const smtpProvider = new SMTPProvider();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeInterviewerType = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'AI';
    const low = raw.toLowerCase();
    if (low === 'human+ai' || low === 'human + ai' || low === 'human & ai') {
        return 'Human + AI';
    }
    if (low === 'human') return 'Human';
    if (low === 'ai') return 'AI';
    return raw;
};

const normalizeInterviewType = (value) => {
    const raw = String(value || '').trim();
    return raw || 'Technical';
};

export const EMAIL_TEMPLATE_KEYS = Object.freeze({
    NEW_ACCOUNT_WELCOME: 'new_account_welcome',
    JOB_DESCRIPTION: 'job_description',
    INTERVIEW_SCHEDULED_CANDIDATE: 'interview_scheduled_candidate',
    INTERVIEW_RESCHEDULED_CANDIDATE: 'interview_rescheduled_candidate',
    INTERVIEW_SCHEDULED_INTERVIEWER: 'interview_scheduled_interviewer',
    INTERVIEW_REMINDER_CANDIDATE: 'interview_reminder_candidate',
});

export const EMAIL_TEMPLATE_DEFINITIONS = Object.freeze([
    {
        key: EMAIL_TEMPLATE_KEYS.NEW_ACCOUNT_WELCOME,
        label: 'New Account Welcome',
        description: 'Sent when a new account is created for a user.',
        variables: ['name', 'role', 'email', 'password', 'urlOrigin', 'loginUrl'],
    },
    {
        key: EMAIL_TEMPLATE_KEYS.JOB_DESCRIPTION,
        label: 'Job Description',
        description: 'Sent to candidates with job description details.',
        variables: ['candidateName', 'jobTitle', 'companyName', 'bodyJD'],
    },
    {
        key: EMAIL_TEMPLATE_KEYS.INTERVIEW_SCHEDULED_CANDIDATE,
        label: 'Interview Scheduled (Candidate)',
        description: 'Sent to candidates when an interview is scheduled.',
        variables: [
            'candidateName', 'jobTitle', 'companyName', 'dateStr', 'timeStr', 'durationStr',
            'mode', 'placeLabel', 'place', 'interviewerTypeLabel', 'interviewTypeLabel',
            'verificationLink', 'joinLink', 'notes', 'loginUrl', 'loginEmail', 'loginPassword'
        ],
    },
    {
        key: EMAIL_TEMPLATE_KEYS.INTERVIEW_RESCHEDULED_CANDIDATE,
        label: 'Interview Rescheduled (Candidate)',
        description: 'Sent to candidates when an interview is rescheduled.',
        variables: [
            'candidateName', 'jobTitle', 'companyName', 'dateStr', 'timeStr', 'durationStr',
            'mode', 'placeLabel', 'place', 'interviewerTypeLabel', 'interviewTypeLabel',
            'verificationLink', 'joinLink', 'notes', 'loginUrl', 'loginEmail', 'loginPassword',
            'activeWindowHours'
        ],
    },
    {
        key: EMAIL_TEMPLATE_KEYS.INTERVIEW_SCHEDULED_INTERVIEWER,
        label: 'Interview Invite (Interviewer)',
        description: 'Sent to interviewers for interview invites.',
        variables: [
            'interviewerName', 'candidateName', 'jobTitle', 'companyName',
            'dateStr', 'timeStr', 'durationStr', 'mode', 'placeLabel', 'place',
            'interviewerTypeLabel', 'interviewTypeLabel', 'notes',
            'loginUrl', 'loginEmail', 'loginPassword'
        ],
    },
    {
        key: EMAIL_TEMPLATE_KEYS.INTERVIEW_REMINDER_CANDIDATE,
        label: 'Interview 30-Min Reminder (Candidate)',
        description: 'Sent to candidates 30 minutes before their interview starts.',
        variables: ['candidateName', 'jobTitle', 'dateStr', 'timeStr', 'interviewerTypeLabel', 'joinLink'],
    },
]);

const EMAIL_TEMPLATE_KEY_SET = new Set(EMAIL_TEMPLATE_DEFINITIONS.map((item) => item.key));

const DEFAULT_EMAIL_TEMPLATE_PAYLOADS = Object.freeze({
    [EMAIL_TEMPLATE_KEYS.NEW_ACCOUNT_WELCOME]: {
        subject: 'Welcome to Hirex REC',
        html: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color:#333; line-height:1.6;">
    <p>Hi {{name}},</p>
    <p>Your <strong>{{role}}</strong> account has been created successfully on <a href="{{urlOrigin}}" target="_blank">Hirex REC</a>.</p>
    <p>You can now log in using the following credentials:</p>
    <ul>
      <li><strong>Login URL:</strong> <a href="{{loginUrl}}" target="_blank">{{loginUrl}}</a></li>
      <li><strong>Email:</strong> {{email}}</li>
      <li><strong>Password:</strong> {{password}}</li>
    </ul>
    <p>For security reasons, please change your password when you log in for the first time.</p>
    <p>If you have any issues logging in, please contact our support team at <a href="mailto:support@hirexit.com">support@hirexit.com</a>.</p>
    <p>Welcome onboard, and we look forward to helping you streamline your hiring process!</p>
    <p>Best regards,<br><strong>The Hirex REC Team</strong></p>
  </body>
</html>`.trim(),
        text: `Hi {{name}},

Your {{role}} account has been created successfully on Hirex REC.

Login URL: {{loginUrl}}
Email: {{email}}
Password: {{password}}

For security reasons, please change your password when you log in for the first time.

If you face any issues, contact support at support@hirexit.com.

Best regards,
The Hirex REC Team`.trim(),
    },
    [EMAIL_TEMPLATE_KEYS.JOB_DESCRIPTION]: {
        subject: 'Job Description: {{jobTitle}} at {{companyName}}',
        html: `<p>Hi {{candidateName}},</p>
<p>As discussed, hereâ€™s the job description for <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>:</p>
<p>{{bodyJD}}</p>
<p>If this looks good, reply to confirm and weâ€™ll move you forward.</p>
<p>Best regards,<br/>The Hirex REC Team</p>`.trim(),
        text: `Hi {{candidateName}},

As discussed, hereâ€™s the job description for {{jobTitle}} at {{companyName}}:

{{bodyJD}}

If this looks good, reply to confirm and weâ€™ll move you forward.

Best regards,
The Hirex REC Team`.trim(),
    },
    [EMAIL_TEMPLATE_KEYS.INTERVIEW_SCHEDULED_CANDIDATE]: {
        subject: 'Interview Scheduled: {{jobTitle}} at {{companyName}}',
        html: `<div style="font-family:Arial, sans-serif; color:#111827; line-height:1.6;">
  <p>Hi {{candidateName}},</p>
  <p>Your interview has been scheduled for <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>.</p>
  <p><strong>Date:</strong> {{dateStr}}<br/>
  <strong>Start time:</strong> {{timeStr}}<br/>
  <strong>Duration:</strong> {{durationStr}}<br/>
  <strong>Interview mode:</strong> {{mode}}<br/>
  <strong>Interviewer type:</strong> {{interviewerTypeLabel}}<br/>
  <strong>Interview type:</strong> {{interviewTypeLabel}}<br/>
  <strong>{{placeLabel}}:</strong> {{place}}</p>
  <p><strong>Verification link:</strong> {{verificationLink}}<br/>
  <strong>Join link:</strong> {{joinLink}}</p>
  <p><strong>Login details:</strong><br/>
  Username (Email): {{loginEmail}}<br/>
  Password: {{loginPassword}}</p>
  <p><strong>Additional instructions:</strong><br/>{{notes}}</p>
  <p>Good luck! If you need to reschedule, reply to this email.</p>
  <p>Regards,<br/>The Hirex REC Team</p>
</div>`.trim(),
        text: `Hi {{candidateName}},

Your interview has been scheduled for {{jobTitle}} at {{companyName}}.

Date: {{dateStr}}
Start time: {{timeStr}}
Duration: {{durationStr}}
Interview mode: {{mode}}
Interviewer type: {{interviewerTypeLabel}}
Interview type: {{interviewTypeLabel}}
{{placeLabel}}: {{place}}
Verification link: {{verificationLink}}
Join link: {{joinLink}}

Login details:
Username (Email): {{loginEmail}}
Password: {{loginPassword}}

Additional instructions:
{{notes}}

Good luck! If you need to reschedule, reply to this email.

Regards,
The Hirex REC Team`.trim(),
    },
    [EMAIL_TEMPLATE_KEYS.INTERVIEW_RESCHEDULED_CANDIDATE]: {
        subject: 'Interview Rescheduled: {{jobTitle}} at {{companyName}}',
        html: `<div style="font-family:Arial, sans-serif; color:#111827; line-height:1.6;">
  <p>Hi {{candidateName}},</p>
  <p>Your interview has been <strong>rescheduled</strong> for <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>.</p>
  <p><strong>Date:</strong> {{dateStr}}<br/>
  <strong>Start time:</strong> {{timeStr}}<br/>
  <strong>Duration:</strong> {{durationStr}}<br/>
  <strong>Interview mode:</strong> {{mode}}<br/>
  <strong>Interviewer type:</strong> {{interviewerTypeLabel}}<br/>
  <strong>Interview type:</strong> {{interviewTypeLabel}}<br/>
  <strong>{{placeLabel}}:</strong> {{place}}</p>
  <p><strong>Verification link:</strong> {{verificationLink}}<br/>
  <strong>Join link:</strong> {{joinLink}}</p>
  <p><strong>Note:</strong> This interview link will be active for {{activeWindowHours}} hours from the start time.</p>
  <p><strong>Login details:</strong><br/>
  Username (Email): {{loginEmail}}<br/>
  Password: {{loginPassword}}</p>
  <p><strong>Additional instructions:</strong><br/>{{notes}}</p>
  <p>Good luck! If you need to reschedule again, reply to this email.</p>
  <p>Regards,<br/>The Hirex REC Team</p>
</div>`.trim(),
        text: `Hi {{candidateName}},

Your interview has been rescheduled for {{jobTitle}} at {{companyName}}.

Date: {{dateStr}}
Start time: {{timeStr}}
Duration: {{durationStr}}
Interview mode: {{mode}}
Interviewer type: {{interviewerTypeLabel}}
Interview type: {{interviewTypeLabel}}
{{placeLabel}}: {{place}}
Verification link: {{verificationLink}}
Join link: {{joinLink}}

Note: This interview link will be active for {{activeWindowHours}} hours from the start time.

Login details:
Username (Email): {{loginEmail}}
Password: {{loginPassword}}

Additional instructions:
{{notes}}

Good luck! If you need to reschedule again, reply to this email.

Regards,
The Hirex REC Team`.trim(),
    },
    [EMAIL_TEMPLATE_KEYS.INTERVIEW_REMINDER_CANDIDATE]: {
        subject: '⏰ Your interview starts in 30 minutes — {{jobTitle}}',
        html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:28px 32px;border-radius:10px 10px 0 0;text-align:center;">
    <div style="font-size:48px;">⏰</div>
    <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:bold;">Your Interview Starts in 30 Minutes!</h1>
    <p style="color:#bfdbfe;margin:6px 0 0;font-size:14px;">{{interviewerTypeLabel}} Interview</p>
  </div>
  <div style="background:#ffffff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
    <p style="font-size:16px;">Hi <strong>{{candidateName}}</strong>,</p>
    <p>This is your <strong>30-minute reminder</strong> for your upcoming <strong>{{interviewerTypeLabel}} Interview</strong> for the position of <strong>{{jobTitle}}</strong>.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;">
      <tr style="background:#eff6ff;"><td style="padding:11px 14px;font-weight:bold;color:#1e40af;width:130px;">📅 Date</td><td style="padding:11px 14px;">{{dateStr}}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:11px 14px;font-weight:bold;color:#1e40af;">🕐 Time</td><td style="padding:11px 14px;">{{timeStr}} (IST)</td></tr>
      <tr style="background:#eff6ff;"><td style="padding:11px 14px;font-weight:bold;color:#1e40af;">🤖 Format</td><td style="padding:11px 14px;">{{interviewerTypeLabel}} Interview</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:11px 14px;font-weight:bold;color:#1e40af;">💼 Position</td><td style="padding:11px 14px;">{{jobTitle}}</td></tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="{{joinLink}}" style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:bold;text-decoration:none;">🎯 Join Interview Now</a>
      <p style="font-size:12px;color:#6b7280;margin-top:10px;">Or copy this link: <a href="{{joinLink}}" style="color:#1d4ed8;">{{joinLink}}</a></p>
    </div>
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:14px 16px;border-radius:4px;margin:20px 0;">
      <p style="font-weight:bold;color:#15803d;margin:0 0 8px;">✅ Last-minute checklist:</p>
      <ul style="margin:0;padding-left:20px;color:#166534;font-size:14px;">
        <li>Ensure you're in a quiet, well-lit location</li>
        <li>Check your internet connection and device audio/camera</li>
        <li>Have your resume or relevant notes handy</li>
        <li>Join 2–3 minutes early to avoid last-minute issues</li>
      </ul>
    </div>
    <p>Best of luck! 🍀<br/><strong>The Hirex REC Team</strong></p>
  </div>
  <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px;">This is an automated reminder. Please do not reply to this email.</p>
</div>`.trim(),
        text: `Hi {{candidateName}},

This is your 30-minute reminder for your upcoming {{interviewerTypeLabel}} Interview for: {{jobTitle}}.

Date    : {{dateStr}}
Time    : {{timeStr}} (IST)
Format  : {{interviewerTypeLabel}} Interview
Position: {{jobTitle}}

Join Link: {{joinLink}}

Last-minute checklist:
  - Quiet, well-lit location
  - Internet connection and audio/camera checked
  - Resume or notes ready
  - Join 2-3 minutes early

Best of luck!
The Hirex REC Team`.trim(),
    },
    [EMAIL_TEMPLATE_KEYS.INTERVIEW_SCHEDULED_INTERVIEWER]: {
        subject: 'Interview Invite: {{candidateName}} for {{jobTitle}} ({{companyName}})',
        html: `<div style="font-family:Arial, sans-serif; color:#111827; line-height:1.6;">
  <p>Hi {{interviewerName}},</p>
  <p>You are scheduled to interview <strong>{{candidateName}}</strong> for the role <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>.</p>
  <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
    <tr><td style="padding:12px 16px; background:#f9fafb; color:#6b7280; width:38%;">Date</td><td style="padding:12px 16px;"><strong>{{dateStr}}</strong></td></tr>
    <tr><td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Start time</td><td style="padding:12px 16px;"><strong>{{timeStr}}</strong></td></tr>
    <tr><td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Duration</td><td style="padding:12px 16px;"><strong>{{durationStr}}</strong></td></tr>
    <tr><td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interview mode</td><td style="padding:12px 16px;"><strong>{{mode}}</strong></td></tr>
    <tr><td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interviewer type</td><td style="padding:12px 16px;"><strong>{{interviewerTypeLabel}}</strong></td></tr>
    <tr><td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interview type</td><td style="padding:12px 16px;"><strong>{{interviewTypeLabel}}</strong></td></tr>
    <tr><td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">{{placeLabel}}</td><td style="padding:12px 16px;"><strong>{{place}}</strong></td></tr>
  </table>
  <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin:14px 0 0;">
    <tr><td colspan="2" style="padding:12px 16px; background:#f9fafb;"><strong>Login details</strong></td></tr>
    <tr><td style="padding:10px 16px; color:#6b7280;">Username (Email)</td><td style="padding:10px 16px; word-break:break-all;">{{loginEmail}}</td></tr>
    <tr><td style="padding:10px 16px; color:#6b7280;">Password</td><td style="padding:10px 16px;"><span style="font-family:Consolas, Monaco, monospace; background:#f3f4f6; border-radius:6px; padding:3px 6px;">{{loginPassword}}</span></td></tr>
  </table>
  <p style="margin:14px 0 0;"><strong>Notes for interviewer:</strong><br/>{{notes}}</p>
  <p style="margin:16px 0 0;">Regards,<br/>The Hirex REC Team</p>
</div>`.trim(),
        text: `Hi {{interviewerName}},

You are scheduled to interview {{candidateName}} for {{jobTitle}} at {{companyName}}.

Date: {{dateStr}}
Start time: {{timeStr}}
Duration: {{durationStr}}
Interview mode: {{mode}}
Interviewer type: {{interviewerTypeLabel}}
Interview type: {{interviewTypeLabel}}
{{placeLabel}}: {{place}}

Login details:
Username (Email): {{loginEmail}}
Password: {{loginPassword}}

Notes for interviewer:
{{notes}}

Regards,
The Hirex REC Team`.trim(),
    },
});

const sanitizeTemplatePayload = (payload = {}) => ({
    subject: String(payload?.subject || '').trim(),
    html: String(payload?.html || '').trim(),
    text: String(payload?.text || '').trim(),
});
const EMAIL_TEMPLATE_USER_FALLBACK_FIELD = 'emailTemplateOverrides';

const toTemplateMap = (templates) => {
    if (!templates) return {};
    if (templates instanceof Map) return Object.fromEntries(templates.entries());
    if (Array.isArray(templates)) {
        const out = {};
        templates.forEach((entry) => {
            const key = String(entry?.key || entry?.templateKey || '').trim();
            if (!key) return;
            out[key] = {
                ...sanitizeTemplatePayload(entry),
                ...(entry?.updatedAt ? { updatedAt: entry.updatedAt } : {}),
                ...(entry?.updatedBy ? { updatedBy: entry.updatedBy } : {}),
            };
        });
        return out;
    }
    if (typeof templates === 'object') return { ...templates };
    return {};
};

const normalizeTemplateMapForPersistence = (templates = {}) =>
    Object.entries(toTemplateMap(templates)).reduce((acc, [key, value]) => {
        const cleanKey = String(key || '').trim();
        if (!cleanKey) return acc;
        acc[cleanKey] = {
            ...sanitizeTemplatePayload(value),
            ...(value?.updatedAt ? { updatedAt: value.updatedAt } : {}),
            ...(value?.updatedBy ? { updatedBy: value.updatedBy } : {}),
        };
        return acc;
    }, {});

const toObjectIdOrNull = (value) => {
    const raw = value?._id || value;
    return mongoose.isValidObjectId(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

const resolveClientIdForQuery = (clientValue) => {
    const raw = clientValue?._id || clientValue;
    const objectId = toObjectIdOrNull(raw);
    if (objectId) return objectId;
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return null;
};

const isCollectionCreationLimitError = (err) => {
    const message = String(err?.message || '').toLowerCase();
    return (
        message.includes('cannot create a new collection') ||
        (message.includes('already using') && message.includes('collections')) ||
        message.includes('maximum number of collections')
    );
};

const loadPrimaryTemplateMap = async (reqContext, clientId) => {
    const Model = reqContext?.conn?.models?.EmailTemplateSetting;
    if (!Model || !clientId) return {};
    const doc = await Model.findOne({ client: clientId }).lean().exec();
    return toTemplateMap(doc?.templates);
};

const loadFallbackTemplateMap = async (reqContext, clientId) => {
    const UserModel = reqContext?.conn?.models?.User;
    const clientObjectId = toObjectIdOrNull(clientId);
    if (!UserModel || !clientObjectId) return {};

    const doc = await UserModel.collection.findOne(
        { _id: clientObjectId },
        { projection: { [EMAIL_TEMPLATE_USER_FALLBACK_FIELD]: 1 } }
    );
    return toTemplateMap(doc?.[EMAIL_TEMPLATE_USER_FALLBACK_FIELD]);
};

const saveFallbackTemplateOverrideForClient = async (
    reqContext,
    clientId,
    templateKey,
    payload
) => {
    const UserModel = reqContext?.conn?.models?.User;
    const clientObjectId = toObjectIdOrNull(clientId);
    if (!UserModel || !clientObjectId) {
        throw new Error('Fallback storage unavailable');
    }

    const result = await UserModel.collection.updateOne(
        { _id: clientObjectId },
        {
            $set: {
                [`${EMAIL_TEMPLATE_USER_FALLBACK_FIELD}.${templateKey}`]: payload
            }
        }
    );

    if (!result?.matchedCount) {
        throw new Error('Client user not found for template fallback storage');
    }
};

const resetFallbackTemplateOverrideForClient = async (
    reqContext,
    clientId,
    templateKey
) => {
    const UserModel = reqContext?.conn?.models?.User;
    const clientObjectId = toObjectIdOrNull(clientId);
    if (!UserModel || !clientObjectId) return;

    await UserModel.collection.updateOne(
        { _id: clientObjectId },
        {
            $unset: {
                [`${EMAIL_TEMPLATE_USER_FALLBACK_FIELD}.${templateKey}`]: ''
            }
        }
    );
};

const getTemplateMapForClient = async (reqContext, clientId) => {
    const [fallbackMap, primaryMap] = await Promise.allSettled([
        loadFallbackTemplateMap(reqContext, clientId),
        loadPrimaryTemplateMap(reqContext, clientId),
    ]);

    const fallback =
        fallbackMap.status === 'fulfilled' ? toTemplateMap(fallbackMap.value) : {};
    const primary =
        primaryMap.status === 'fulfilled' ? toTemplateMap(primaryMap.value) : {};

    return { ...fallback, ...primary };
};

const replaceTemplateVariables = (template = '', variables = {}) =>
    String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
        if (!Object.prototype.hasOwnProperty.call(variables, key)) return '';
        const value = variables[key];
        return value === undefined || value === null ? '' : String(value);
    });

export const resolveTemplatePayload = async ({
    reqContext,
    templateKey,
    variables = {},
    fallbackPayload,
    useClientTemplate = true
}) => {
    const defaultPayload =
        fallbackPayload || DEFAULT_EMAIL_TEMPLATE_PAYLOADS[templateKey] || { subject: '', html: '', text: '' };

    if (!useClientTemplate) {
        return {
            subject: replaceTemplateVariables(defaultPayload.subject, variables),
            html: replaceTemplateVariables(defaultPayload.html, variables),
            text: replaceTemplateVariables(defaultPayload.text, variables),
        };
    }

    const clientId = resolveClientIdForQuery(reqContext?.client);
    if (!clientId) {
        return {
            subject: replaceTemplateVariables(defaultPayload.subject, variables),
            html: replaceTemplateVariables(defaultPayload.html, variables),
            text: replaceTemplateVariables(defaultPayload.text, variables),
        };
    }

    try {
        const templateMap = await getTemplateMapForClient(reqContext, clientId);
        const customPayload = sanitizeTemplatePayload(templateMap?.[templateKey] || {});
        const merged = {
            subject: customPayload.subject || defaultPayload.subject,
            html: customPayload.html || defaultPayload.html,
            text: customPayload.text || defaultPayload.text,
        };

        return {
            subject: replaceTemplateVariables(merged.subject, variables),
            html: replaceTemplateVariables(merged.html, variables),
            text: replaceTemplateVariables(merged.text, variables),
        };
    } catch (err) {
        console.warn('[EmailTemplate] Failed to resolve client email template, using defaults:', err?.message || err);
        return {
            subject: replaceTemplateVariables(defaultPayload.subject, variables),
            html: replaceTemplateVariables(defaultPayload.html, variables),
            text: replaceTemplateVariables(defaultPayload.text, variables),
        };
    }
};

export const isValidEmailTemplateKey = (templateKey) =>
    EMAIL_TEMPLATE_KEY_SET.has(String(templateKey || '').trim());

export async function getMergedEmailTemplatesForClient(reqContext) {
    const clientId = resolveClientIdForQuery(reqContext?.client);
    const templateMap = clientId
        ? await getTemplateMapForClient(reqContext, clientId)
        : {};

    return EMAIL_TEMPLATE_DEFINITIONS.map((definition) => {
        const defaultPayload = DEFAULT_EMAIL_TEMPLATE_PAYLOADS[definition.key] || {
            subject: '',
            html: '',
            text: '',
        };
        const customPayload = sanitizeTemplatePayload(templateMap?.[definition.key] || {});
        const merged = {
            subject: customPayload.subject || defaultPayload.subject,
            html: customPayload.html || defaultPayload.html,
            text: customPayload.text || defaultPayload.text,
        };
        return {
            ...definition,
            ...merged,
            defaultSubject: defaultPayload.subject,
            defaultHtml: defaultPayload.html,
            defaultText: defaultPayload.text,
            isCustomized: Boolean(customPayload.subject || customPayload.html || customPayload.text),
            updatedAt: templateMap?.[definition.key]?.updatedAt || null,
            updatedBy: templateMap?.[definition.key]?.updatedBy || null,
        };
    });
}

export async function saveEmailTemplateOverrideForClient(reqContext, templateKey, payload) {
    const key = String(templateKey || '').trim();
    if (!isValidEmailTemplateKey(key)) throw new Error('Invalid template key');
    const Model = reqContext?.conn?.models?.EmailTemplateSetting;
    if (!Model || !reqContext?.client) {
        throw new Error('EmailTemplateSetting model unavailable');
    }

    const normalized = sanitizeTemplatePayload(payload);
    const clientId = resolveClientIdForQuery(reqContext.client);
    if (!clientId) throw new Error('Invalid client context');
    const updatedBy = toObjectIdOrNull(reqContext?.user?._id);
    const payloadToPersist = {
        ...normalized,
        updatedAt: new Date(),
        updatedBy,
    };

    try {
        const current = await Model.collection.findOne(
            { client: clientId },
            { projection: { templates: 1 } }
        );
        const templateMap = normalizeTemplateMapForPersistence(current?.templates || {});
        templateMap[key] = payloadToPersist;

        await Model.collection.updateOne(
            { client: clientId },
            {
                $set: { templates: templateMap },
                $setOnInsert: { client: clientId, createdAt: new Date() },
                $currentDate: { updatedAt: true }
            },
            { upsert: true }
        );
    } catch (err) {
        if (!isCollectionCreationLimitError(err)) {
            throw err;
        }
        await saveFallbackTemplateOverrideForClient(
            reqContext,
            clientId,
            key,
            payloadToPersist
        );
    }
}

export async function resetEmailTemplateOverrideForClient(reqContext, templateKey) {
    const key = String(templateKey || '').trim();
    if (!isValidEmailTemplateKey(key)) throw new Error('Invalid template key');
    const Model = reqContext?.conn?.models?.EmailTemplateSetting;
    if (!Model || !reqContext?.client) {
        throw new Error('EmailTemplateSetting model unavailable');
    }

    const clientId = resolveClientIdForQuery(reqContext.client);
    if (!clientId) throw new Error('Invalid client context');

    try {
        const current = await Model.collection.findOne(
            { client: clientId },
            { projection: { templates: 1 } }
        );
        const templateMap = normalizeTemplateMapForPersistence(current?.templates || {});
        delete templateMap[key];

        await Model.collection.updateOne(
            { client: clientId },
            { $set: { templates: templateMap }, $currentDate: { updatedAt: true } },
            { upsert: true }
        );
    } catch (err) {
        if (!isCollectionCreationLimitError(err)) {
            throw err;
        }
    }

    await resetFallbackTemplateOverrideForClient(reqContext, clientId, key);
}

const UNSUBSCRIBE_TEXT = 'If you no longer want to receive emails from us, click here to unsubscribe:';

const extractEmailFromRecipient = (raw = '') => {
    const text = String(raw || '').trim();
    if (!text) return '';
    const angled = text.match(/<([^>]+)>/);
    const candidate = String(angled?.[1] || text)
        .trim()
        .toLowerCase();
    return emailRegex.test(candidate) ? candidate : '';
};

const normalizeRecipientList = (toValue) => {
    const rawList = Array.isArray(toValue) ? toValue : [toValue];
    const deduped = new Set();
    for (const item of rawList) {
        const parts = String(item || '')
            .split(/[;,]/g)
            .map((part) => extractEmailFromRecipient(part))
            .filter(Boolean);
        parts.forEach((email) => deduped.add(email));
    }
    return Array.from(deduped);
};

const resolveDbNameFromReqContext = (reqContext = null) => {
    return String(
        reqContext?.dbName ||
        reqContext?.req?.dbName ||
        reqContext?.conn?.name ||
        ''
    ).trim();
};

const resolveClientIdFromReqContext = (reqContext = null) => {
    return (
        reqContext?.client?._id ||
        reqContext?.client ||
        reqContext?.req?.client ||
        reqContext?.user?.client ||
        reqContext?.req?.user?.client ||
        null
    );
};

const resolveTenantConnection = async (reqContext = null, connCache = {}) => {
    if (connCache.conn) return connCache.conn;
    if (reqContext?.conn?.models) {
        connCache.conn = reqContext.conn;
        return connCache.conn;
    }

    const dbName = resolveDbNameFromReqContext(reqContext);
    if (!dbName) return null;
    const conn = await getClientDbConn(dbName);
    connCache.conn = conn;
    return conn;
};

const isRecipientUnsubscribed = async ({ email, reqContext, connCache = {} }) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return false;

    const conn = await resolveTenantConnection(reqContext, connCache);
    if (!conn?.models) return false;

    const User = conn.models.User;
    const Candidate = conn.models.Candidate;
    const client = resolveClientIdFromReqContext(reqContext);
    const baseFilter = { email: normalizedEmail, emailUnsubscribed: true };
    const scopedFilter = client ? { ...baseFilter, client } : baseFilter;

    const [userMatch, candidateMatch] = await Promise.all([
        User ? User.exists(scopedFilter) : null,
        Candidate ? Candidate.exists(scopedFilter) : null,
    ]);

    return Boolean(userMatch || candidateMatch);
};

const buildUnsubscribeUrl = ({ email, reqContext }) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const dbName = resolveDbNameFromReqContext(reqContext);
    if (!normalizedEmail || !dbName) return null;

    const token = createEmailUnsubscribeToken({
        email: normalizedEmail,
        dbName,
        clientId: resolveClientIdFromReqContext(reqContext),
    });
    if (!token) return null;

    const frontendOrigin = getFrontendOriginForEmails();
    return `${frontendOrigin}/unsubscribe?token=${encodeURIComponent(token)}`;
};

const appendUnsubscribeFooterHtml = (html, unsubscribeUrl) => {
    const body = String(html || '').trim();
    if (!unsubscribeUrl || /unsubscribe\?token=/i.test(body)) return body;

    const footer = `
<div style="margin-top:20px; padding-top:14px; border-top:1px solid #e5e7eb; font-size:12px; color:#6b7280;">
  If you no longer want to receive emails from us,
  <a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline;">click here to unsubscribe</a>.
</div>`.trim();

    if (!body) return footer;
    if (/<\/body>/i.test(body)) return body.replace(/<\/body>/i, `${footer}\n</body>`);
    if (/<\/html>/i.test(body)) return body.replace(/<\/html>/i, `${footer}\n</html>`);
    return `${body}\n${footer}`;
};

const appendUnsubscribeFooterText = (text, unsubscribeUrl) => {
    const body = String(text || '').trim();
    if (!unsubscribeUrl || /unsubscribe\?token=/i.test(body)) return body;
    const footer = `${UNSUBSCRIBE_TEXT} ${unsubscribeUrl}`;
    if (!body) return footer;
    return `${body}\n\n${footer}`;
};

const sendEmailThroughProviders = async (mailData, reqContext = null) => {
    const to = String(mailData?.to || '').trim().toLowerCase();
    if (!to) {
        const err = new Error('EMAIL_NOT_FOUND_OR_INVALID');
        err.name = 'EmailNotFound';
        throw err;
    }

    try {
        await graphMailProvider.send({ ...mailData, to, reqContext });
        console.log('[Email] sent via Microsoft Graph');
        return { provider: 'graph', status: 'sent' };
    } catch (graphErr) {
        console.warn('[Email] Microsoft Graph failed, retrying with Gmail API:', graphErr?.message || graphErr);
        try {
            await gmailProvider.send({ ...mailData, to, reqContext });
            console.log('[Email] sent via Gmail API');
            return { provider: 'gmail', status: 'sent' };
        } catch (gmailErr) {
            console.warn('[Email] Gmail failed, retrying with SMTP:', gmailErr?.message || gmailErr);
            try {
                await smtpProvider.send({ ...mailData, to, reqContext });
                console.log('[Email] sent via SMTP');
                return { provider: 'smtp', status: 'sent' };
            } catch (smtpErr) {
                console.error('[Email] Graph, Gmail, and SMTP failed:', smtpErr?.message || smtpErr);
                const err = new Error('All email providers failed');
                err.name = 'EmailSendFailed';
                err.graph = graphErr?.message;
                err.gmail = gmailErr?.message;
                err.smtp = smtpErr?.message;
                throw err;
            }
        }
    }
};

export async function sendEmail(mailData) {
    const recipients = normalizeRecipientList(mailData?.to);
    if (!recipients.length) {
        const err = new Error('EMAIL_NOT_FOUND_OR_INVALID');
        err.name = 'EmailNotFound';
        throw err;
    }

    const reqContext = mailData?.reqContext || null;
    const unsubscribeDisabled = Boolean(mailData?.unsubscribeDisabled);
    const connCache = {};
    const sent = [];
    const skipped = [];
    const failed = [];

    for (const to of recipients) {
        try {
            if (!unsubscribeDisabled) {
                const unsubscribed = await isRecipientUnsubscribed({ email: to, reqContext, connCache });
                if (unsubscribed) {
                    skipped.push({ to, reason: 'unsubscribed' });
                    continue;
                }
            }

            const unsubscribeUrl = unsubscribeDisabled
                ? null
                : buildUnsubscribeUrl({ email: to, reqContext });
            const payload = {
                ...mailData,
                to,
                html: appendUnsubscribeFooterHtml(mailData?.html, unsubscribeUrl),
                text: appendUnsubscribeFooterText(mailData?.text, unsubscribeUrl),
            };
            delete payload.reqContext;
            delete payload.unsubscribeDisabled;

            const result = await sendEmailThroughProviders(payload, reqContext);
            sent.push({ to, ...result });
        } catch (err) {
            failed.push({
                to,
                message: err?.message || String(err),
                name: err?.name || 'Error',
            });
        }
    }

    if (failed.length) {
        const err = new Error('One or more email deliveries failed');
        err.name = 'EmailSendFailed';
        err.details = failed;
        err.sent = sent;
        err.skipped = skipped;
        throw err;
    }

    if (!sent.length && skipped.length) {
        return { status: 'skipped', skipped, sent: [] };
    }

    if (recipients.length === 1 && sent.length === 1) {
        return {
            provider: sent[0].provider,
            status: sent[0].status,
            to: sent[0].to,
            skipped,
        };
    }

    return {
        status: 'sent',
        sent,
        skipped,
    };
}

export async function getNewAccountMailMsg({
    name,
    role,
    email,
    password,
    urlOrigin = "https://hirexit.ai",
    reqContext = null,
}) {
    const loginUrl = `${String(urlOrigin || '').replace(/\/+$/, '')}/auth/login/`;
    const html = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color:#333; line-height:1.6;">
    <p>Hi ${name},</p>

    <p>Your <strong>${role}</strong> account has been created successfully on <a href="${urlOrigin}" target="_blank">Hirex REC</a>.</p>

    <p>You can now log in using the following credentials:</p>

    <ul>
      <li><strong>Login URL:</strong> <a href="${urlOrigin}/auth/login/" target="_blank">${urlOrigin}/auth/login/</a></li>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Password:</strong> ${password}</li>
    </ul>

    <p>For security reasons, please change your password when you log in for the first time.</p>

    <p>If you have any issues logging in, please contact our support team at <a href="mailto:support@hirexit.com">support@hirexit.com</a>.</p>

    <p>Welcome onboard, and we look forward to helping you streamline your hiring process!</p>

    <br>
    <p>Best regards,<br>
    <strong>The Hirex REC Team</strong></p>
	  </body>
</html>
    `;

    const text = `Hi ${name},

Your ${role} account has been created successfully on Hirex REC.

Login URL: ${loginUrl}
Email: ${email}
Password: ${password}

For security reasons, please change your password when you log in for the first time.

If you face any issues, contact support at support@hirexit.com.

Best regards,
The Hirex REC Team

    `;

    const template = await resolveTemplatePayload({
        reqContext,
        templateKey: EMAIL_TEMPLATE_KEYS.NEW_ACCOUNT_WELCOME,
        variables: {
            name,
            role,
            email,
            password,
            urlOrigin,
            loginUrl,
        },
        fallbackPayload: {
            subject: 'Welcome to Hirex REC',
            html,
            text
        }
    });

    return template;
}

export async function sendJobDescriptionEmail({
    to,
    jobTitle,
    companyName = 'our client',
    fullJD = '',
    shortJD = '',
    candidateName = 'there',
    reqContext = null
}) {
    const bodyJD = (fullJD && String(fullJD).trim()) || String(shortJD || '').trim() || 'Job details will be shared in the next interaction.';
    const subject = `Job Description: ${jobTitle} at ${companyName}`;

    const html = `
    <p>Hi ${candidateName},</p>
    <p>As discussed, hereâ€™s the job description for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>:</p>
    <p>${bodyJD.replace(/\n/g, '<br/>')}</p>
    <p>If this looks good, reply to confirm and weâ€™ll move you forward.</p>
    <p>Best regards,<br/>The Hirex REC Team</p>
  `.trim();

    const text = `
Hi ${candidateName},

As discussed, hereâ€™s the job description for ${jobTitle} at ${companyName}:

${bodyJD}

If this looks good, reply to confirm and weâ€™ll move you forward.

Best regards,
The Hirex REC Team
  `.trim();

    const template = await resolveTemplatePayload({
        reqContext,
        templateKey: EMAIL_TEMPLATE_KEYS.JOB_DESCRIPTION,
        variables: {
            candidateName,
            jobTitle,
            companyName,
            bodyJD
        },
        fallbackPayload: { subject, html, text }
    });

    return sendEmail({ to, ...template, reqContext });
}

/* ------------------ NEW: interview scheduling emails ------------------ */

export async function sendInterviewScheduledCandidateEmail({
    to,
    candidateName = 'Candidate',
    jobTitle = 'Job',
    companyName = 'our client',
    dateStr = 'N/A',
    timeStr = 'N/A',
    durationStr = 'N/A',
    mode = 'Virtual',
    place = 'N/A',
    notes = '',
    loginEmail = null,
    loginPassword = null,
    interviewerType = 'AI',
    interviewType = 'Technical',
    webrtcLink = null,
    verificationLink = null,
    urlOrigin = 'https://hirexit.ai',
    reqContext = null
}) {
    const subject = `Interview Scheduled: ${jobTitle} at ${companyName}`;
    const placeLabel = mode === 'Onsite' ? 'Address' : (mode === 'Phone' ? 'Dial/Link' : 'Interview Link');
    const interviewerTypeLabel = normalizeInterviewerType(interviewerType);
    const interviewTypeLabel = normalizeInterviewType(interviewType);
    const loginUrl = `${String(urlOrigin || '').replace(/\/+$/, '')}/auth/login/`;

    const hasLoginEmail = Boolean(loginEmail);
    const hasLoginPassword = Boolean(loginPassword);
    const loginStep1 = hasLoginPassword
        ? 'Open the Interview URL and sign in using the provided Username (Email) and Password.'
        : 'Open the Interview URL and sign in using your existing password (or reset it if needed).';

    const joinLink = webrtcLink || (mode === 'Virtual' && place && place !== 'N/A' ? place : null);
    const steps = [];
    if (mode === 'Virtual') {
        if (verificationLink) {
            steps.push('Complete identity verification first by uploading a clear photo/video or a live capture.');
        }
        if (hasLoginEmail) {
            steps.push(loginStep1);
        }
        if (!hasLoginEmail && joinLink) {
            steps.push('Open the interview link in a modern browser (Chrome/Edge).');
        }
        steps.push('Allow microphone and camera access when prompted.');
        if (interviewerTypeLabel === 'AI') {
            steps.push('Click Start Answer, then say "Hello" to begin.');
            steps.push('Click Stop after each response and wait for the next question.');
        } else {
            steps.push('Wait for the interviewer to join the room.');
        }
        steps.push('Use the End Call button to finish when the interview is complete.');
    } else if (mode === 'Phone') {
        steps.push('Use the dial-in link or number at the scheduled time.');
    } else if (mode === 'Onsite') {
        steps.push('Arrive 10 minutes early at the address below.');
    }

    const placeValue = String(place || 'N/A');
    const placeLooksLikeUrl = /^https?:\/\//i.test(placeValue);
    const placeHtml = joinLink
        ? `
          <a href="${joinLink}" target="_blank" style="color:#2563eb; text-decoration:underline; font-weight:600;">Open interview link</a>
          <div style="margin-top:6px; color:#6b7280; font-size:12px; word-break:break-all;">${joinLink}</div>
        `
        : placeLooksLikeUrl
            ? `<a href="${placeValue}" target="_blank" style="color:#2563eb; text-decoration:underline; word-break:break-all;">${placeValue}</a>`
            : `<strong style="word-break:break-word;">${placeValue}</strong>`;

    const isHumanType = interviewerTypeLabel === 'Human' || interviewerTypeLabel === 'Human + AI';

    const loginStepsBlock = !isHumanType && steps.length
        ? `
    <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin:14px 0 0;">
      <tr>
        <td style="padding:12px 16px; background:#f9fafb;"><strong>How to join</strong></td>
      </tr>
      <tr>
        <td style="padding:12px 16px;">
          <ol style="padding-left:18px; margin:0;">
            ${steps.map((s) => `<li style="margin:6px 0;">${s}</li>`).join('')}
          </ol>
        </td>
      </tr>
    </table>
    `
        : '';
    const loginCredentialsBlock = hasLoginEmail && hasLoginPassword
        ? `
    <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin:14px 0 0;">
      <tr>
        <td colspan="2" style="padding:12px 16px; background:#f9fafb;"><strong>Login details</strong></td>
      </tr>
      <tr>
        <td style="padding:10px 16px; color:#6b7280;">Username (Email)</td>
        <td style="padding:10px 16px; word-break:break-all;"><a href="mailto:${loginEmail}" style="color:#2563eb; text-decoration:underline;">${loginEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:10px 16px; color:#6b7280;">Password</td>
        <td style="padding:10px 16px;"><span style="font-family:Consolas, Monaco, monospace; background:#f3f4f6; border-radius:6px; padding:3px 6px;">${loginPassword}</span></td>
      </tr>
    </table>
    `
        : '';
    const html = `
    <div style="font-family:Arial, sans-serif; color:#111827; line-height:1.6;">
      <table role="presentation" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 18px 0;">
            <p style="margin:0 0 10px 0;">Hi ${candidateName},</p>
            <p style="margin:0;">Your interview has been scheduled for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
          </td>
        </tr>
      </table>

      <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280; width:38%;">Date</td>
          <td style="padding:12px 16px;"><strong>${dateStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Start time</td>
          <td style="padding:12px 16px;"><strong>${timeStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Duration</td>
          <td style="padding:12px 16px;"><strong>${durationStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interview mode</td>
          <td style="padding:12px 16px;"><strong>${mode}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interviewer type</td>
          <td style="padding:12px 16px;"><strong>${interviewerTypeLabel}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interview type</td>
          <td style="padding:12px 16px;"><strong>${interviewTypeLabel}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">${placeLabel}</td>
          <td style="padding:12px 16px;">${placeHtml}</td>
        </tr>
      </table>

      ${verificationLink ? `
      <div style="margin:18px 0 10px 0;">
        <a href="${verificationLink}" target="_blank" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;">Complete Verification</a>
      </div>` : ''}

      ${joinLink ? `
      <div style="margin:18px 0 10px 0;">
        <a href="${joinLink}" target="_blank" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;">Join Interview</a>
      </div>` : ''}

      ${notes ? `<p style="margin:14px 0 0;"><strong>Additional instructions:</strong><br/>${String(notes).replace(/\n/g, '<br/>')}</p>` : ''}
      ${loginCredentialsBlock}
      ${loginStepsBlock}

      <p style="margin:16px 0 0;">Good luck! If you need to reschedule, reply to this email.</p>
      <p style="margin:10px 0 0;">Regards,<br/>The Hirex REC Team</p>
    </div>
    `.trim();

    const loginStepsText = !isHumanType && steps.length
        ? `How to join:
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        : '';
    const loginCredentialsText = hasLoginEmail && hasLoginPassword
        ? `Login details:
Username (Email): ${loginEmail}
Password: ${loginPassword}`
        : '';
    let sectionsText = '';
    if (loginCredentialsText) {
        sectionsText += loginCredentialsText;
    }
    if (loginStepsText) {
        sectionsText += (sectionsText ? '\n\n' : '') + loginStepsText;
    }

    const text = `
Hi ${candidateName},

Your interview has been scheduled for ${jobTitle} at ${companyName}.

Date: ${dateStr}
Start time: ${timeStr}
Duration: ${durationStr}
Interview mode: ${mode}
Interviewer type: ${interviewerTypeLabel}
Interview type: ${interviewTypeLabel}
${placeLabel}: ${place}
${verificationLink ? `Verification link: ${verificationLink}\n` : ''}
${joinLink ? `Join link: ${joinLink}\n` : ''}${notes ? `Additional instructions:\n${notes}\n` : ''}${sectionsText ? `${sectionsText}\n\n` : ''}
Good luck! If you need to reschedule, reply to this email.

Regards,
The Hirex REC Team
    `.trim();

    const template = await resolveTemplatePayload({
        reqContext,
        templateKey: EMAIL_TEMPLATE_KEYS.INTERVIEW_SCHEDULED_CANDIDATE,
        variables: {
            candidateName,
            jobTitle,
            companyName,
            dateStr,
            timeStr,
            durationStr,
            mode,
            placeLabel,
            place,
            interviewerTypeLabel,
            interviewTypeLabel,
            verificationLink: verificationLink || '',
            joinLink: joinLink || '',
            notes: notes || '',
            loginUrl,
            loginEmail: loginEmail || '',
            loginPassword: loginPassword || '',
        },
        fallbackPayload: { subject, html, text },
        useClientTemplate: false
    });

    return sendEmail({ to, ...template, reqContext });
}

export async function sendInterviewRescheduledCandidateEmail({
    to,
    candidateName = 'Candidate',
    jobTitle = 'Job',
    companyName = 'our client',
    dateStr = 'N/A',
    timeStr = 'N/A',
    durationStr = 'N/A',
    mode = 'Virtual',
    place = 'N/A',
    notes = '',
    loginEmail = null,
    loginPassword = null,
    interviewerType = 'AI',
    interviewType = 'Technical',
    webrtcLink = null,
    verificationLink = null,
    urlOrigin = 'https://hirexit.ai',
    activeWindowHours = 48,
    reqContext = null
}) {
    const subject = `Interview Rescheduled: ${jobTitle} at ${companyName}`;
    const placeLabel = mode === 'Onsite' ? 'Address' : (mode === 'Phone' ? 'Dial/Link' : 'Interview Link');
    const interviewerTypeLabel = normalizeInterviewerType(interviewerType);
    const interviewTypeLabel = normalizeInterviewType(interviewType);
    const loginUrl = `${String(urlOrigin || '').replace(/\/+$/, '')}/auth/login/`;

    const hasLoginEmail = Boolean(loginEmail);
    const hasLoginPassword = Boolean(loginPassword);
    const loginStep1 = hasLoginPassword
        ? 'Open the Interview URL and sign in using the provided Username (Email) and Password.'
        : 'Open the Interview URL and sign in using your existing password (or reset it if needed).';

    const joinLink = webrtcLink || (mode === 'Virtual' && place && place !== 'N/A' ? place : null);
    const steps = [];
    if (mode === 'Virtual') {
        if (verificationLink) {
            steps.push('Complete identity verification first by uploading a clear photo/video or a live capture.');
        }
        if (hasLoginEmail) {
            steps.push(loginStep1);
        }
        if (!hasLoginEmail && joinLink) {
            steps.push('Open the interview link in a modern browser (Chrome/Edge).');
        }
        steps.push('Allow microphone and camera access when prompted.');
        if (interviewerTypeLabel === 'AI') {
            steps.push('Click Start Answer, then say "Hello" to begin.');
            steps.push('Click Stop after each response and wait for the next question.');
        } else {
            steps.push('Wait for the interviewer to join the room.');
        }
        steps.push('Use the End Call button to finish when the interview is complete.');
    } else if (mode === 'Phone') {
        steps.push('Use the dial-in link or number at the scheduled time.');
    } else if (mode === 'Onsite') {
        steps.push('Arrive 10 minutes early at the address below.');
    }

    const placeValue = String(place || 'N/A');
    const placeLooksLikeUrl = /^https?:\/\//i.test(placeValue);
    const placeHtml = joinLink
        ? `
          <a href="${joinLink}" target="_blank" style="color:#2563eb; text-decoration:underline; font-weight:600;">Open interview link</a>
          <div style="margin-top:6px; color:#6b7280; font-size:12px; word-break:break-all;">${joinLink}</div>
        `
        : placeLooksLikeUrl
            ? `<a href="${placeValue}" target="_blank" style="color:#2563eb; text-decoration:underline; word-break:break-all;">${placeValue}</a>`
            : `<strong style="word-break:break-word;">${placeValue}</strong>`;

    const isHumanType = interviewerTypeLabel === 'Human' || interviewerTypeLabel === 'Human + AI';

    const loginStepsBlock = !isHumanType && steps.length
        ? `
    <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin:14px 0 0;">
      <tr>
        <td style="padding:12px 16px; background:#f9fafb;"><strong>How to join</strong></td>
      </tr>
      <tr>
        <td style="padding:12px 16px;">
          <ol style="padding-left:18px; margin:0;">
            ${steps.map((s) => `<li style="margin:6px 0;">${s}</li>`).join('')}
          </ol>
        </td>
      </tr>
    </table>
    `
        : '';
    const loginCredentialsBlock = hasLoginEmail && hasLoginPassword
        ? `
    <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin:14px 0 0;">
      <tr>
        <td colspan="2" style="padding:12px 16px; background:#f9fafb;"><strong>Login details</strong></td>
      </tr>
      <tr>
        <td style="padding:10px 16px; color:#6b7280;">Username (Email)</td>
        <td style="padding:10px 16px; word-break:break-all;"><a href="mailto:${loginEmail}" style="color:#2563eb; text-decoration:underline;">${loginEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:10px 16px; color:#6b7280;">Password</td>
        <td style="padding:10px 16px;"><span style="font-family:Consolas, Monaco, monospace; background:#f3f4f6; border-radius:6px; padding:3px 6px;">${loginPassword}</span></td>
      </tr>
    </table>
    `
        : '';
    const html = `
    <div style="font-family:Arial, sans-serif; color:#111827; line-height:1.6;">
      <table role="presentation" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 18px 0;">
            <p style="margin:0 0 10px 0;">Hi ${candidateName},</p>
            <p style="margin:0;">Your interview has been <strong>rescheduled</strong> for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
          </td>
        </tr>
      </table>

      <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280; width:38%;">Date</td>
          <td style="padding:12px 16px;"><strong>${dateStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Start time</td>
          <td style="padding:12px 16px;"><strong>${timeStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Duration</td>
          <td style="padding:12px 16px;"><strong>${durationStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interview mode</td>
          <td style="padding:12px 16px;"><strong>${mode}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interviewer type</td>
          <td style="padding:12px 16px;"><strong>${interviewerTypeLabel}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interview type</td>
          <td style="padding:12px 16px;"><strong>${interviewTypeLabel}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">${placeLabel}</td>
          <td style="padding:12px 16px;">${placeHtml}</td>
        </tr>
      </table>

      ${verificationLink ? `
      <div style="margin:18px 0 10px 0;">
        <a href="${verificationLink}" target="_blank" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;">Complete Verification</a>
      </div>` : ''}

      ${joinLink ? `
      <div style="margin:18px 0 10px 0;">
        <a href="${joinLink}" target="_blank" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;">Join Interview</a>
      </div>` : ''}

      <p style="margin:14px 0 0;"><strong>Note:</strong> This interview link will be active for ${activeWindowHours} hours from the start time.</p>
      ${notes ? `<p style="margin:12px 0 0;"><strong>Additional instructions:</strong><br/>${String(notes).replace(/\n/g, '<br/>')}</p>` : ''}
      ${loginCredentialsBlock}
      ${loginStepsBlock}

      <p style="margin:16px 0 0;">Good luck! If you need to reschedule again, reply to this email.</p>
      <p style="margin:10px 0 0;">Regards,<br/>The Hirex REC Team</p>
    </div>
    `.trim();

    const loginStepsText = !isHumanType && steps.length
        ? `How to join:
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        : '';
    const loginCredentialsText = hasLoginEmail && hasLoginPassword
        ? `Login details:
Username (Email): ${loginEmail}
Password: ${loginPassword}`
        : '';
    let sectionsText = '';
    if (loginCredentialsText) {
        sectionsText += loginCredentialsText;
    }
    if (loginStepsText) {
        sectionsText += (sectionsText ? '\n\n' : '') + loginStepsText;
    }

    const text = `
Hi ${candidateName},

Your interview has been rescheduled for ${jobTitle} at ${companyName}.

Date: ${dateStr}
Start time: ${timeStr}
Duration: ${durationStr}
Interview mode: ${mode}
Interviewer type: ${interviewerTypeLabel}
Interview type: ${interviewTypeLabel}
${placeLabel}: ${place}

Note: This interview link will be active for ${activeWindowHours} hours from the start time.
${verificationLink ? `\nVerification link: ${verificationLink}` : ''}
${joinLink ? `\nJoin link: ${joinLink}` : ''}${notes ? `\nAdditional instructions:\n${String(notes)}` : ''}${sectionsText ? `\n\n${sectionsText}` : ''}

Good luck! If you need to reschedule again, reply to this email.

Regards,
The Hirex REC Team
    `.trim();

    const template = await resolveTemplatePayload({
        reqContext,
        templateKey: EMAIL_TEMPLATE_KEYS.INTERVIEW_RESCHEDULED_CANDIDATE,
        variables: {
            candidateName,
            jobTitle,
            companyName,
            dateStr,
            timeStr,
            durationStr,
            mode,
            placeLabel,
            place,
            interviewerTypeLabel,
            interviewTypeLabel,
            verificationLink: verificationLink || '',
            joinLink: joinLink || '',
            notes: notes || '',
            loginUrl,
            loginEmail: loginEmail || '',
            loginPassword: loginPassword || '',
            activeWindowHours,
        },
        fallbackPayload: { subject, html, text },
        useClientTemplate: false
    });

    return sendEmail({ to, ...template, reqContext });
}

export async function sendInterviewScheduledInterviewerEmail({
    to,
    interviewerName = 'Interviewer',
    candidateName = 'Candidate',
    jobTitle = 'Job',
    companyName = 'our client',
    dateStr = 'N/A',
    timeStr = 'N/A',
    durationStr = 'N/A',
    mode = 'Virtual',
    place = 'N/A',
    notes = '',
    loginEmail = null,
    loginPassword = null,
    interviewerType = 'Human',
    interviewType = 'Technical',
    urlOrigin = 'https://hirexit.ai',
    reqContext = null
}) {
    const subject = `Interview Invite: ${candidateName} for ${jobTitle} (${companyName})`;
    const placeLabel = mode === 'Onsite' ? 'Address' : (mode === 'Phone' ? 'Dial/Link' : 'Interview Link');
    const interviewerTypeLabel = normalizeInterviewerType(interviewerType);
    const interviewTypeLabel = normalizeInterviewType(interviewType);
    const loginUrl = `${String(urlOrigin || '').replace(/\/+$/, '')}/auth/login/`;

    const isHumanType = interviewerTypeLabel === 'Human' || interviewerTypeLabel === 'Human + AI';
    const hasLoginEmail = Boolean(loginEmail);
    const hasLoginPassword = Boolean(loginPassword);

    const placeValue = String(place || 'N/A');
    const placeLooksLikeUrl = /^https?:\/\//i.test(placeValue);
    const joinLink = mode === 'Virtual' && placeLooksLikeUrl ? placeValue : null;

    const placeHtml = joinLink
        ? `<a href="${joinLink}" target="_blank" style="color:#2563eb; text-decoration:underline; font-weight:600;">Open interview link</a><div style="margin-top:6px; color:#6b7280; font-size:12px; word-break:break-all;">${joinLink}</div>`
        : placeLooksLikeUrl
            ? `<a href="${placeValue}" target="_blank" style="color:#2563eb; text-decoration:underline; word-break:break-all;">${placeValue}</a>`
            : `<strong style="word-break:break-word;">${placeValue}</strong>`;

    const loginCredentialsBlock = isHumanType && hasLoginEmail && hasLoginPassword
        ? `
    <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin:14px 0 0;">
      <tr>
        <td colspan="2" style="padding:12px 16px; background:#f9fafb;"><strong>Login details</strong></td>
      </tr>
      <tr>
        <td style="padding:10px 16px; color:#6b7280;">Username (Email)</td>
        <td style="padding:10px 16px; word-break:break-all;"><a href="mailto:${loginEmail}" style="color:#2563eb; text-decoration:underline;">${loginEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:10px 16px; color:#6b7280;">Password</td>
        <td style="padding:10px 16px;"><span style="font-family:Consolas, Monaco, monospace; background:#f3f4f6; border-radius:6px; padding:3px 6px;">${loginPassword}</span></td>
      </tr>
    </table>
    `
        : '';

    const html = `
    <div style="font-family:Arial, sans-serif; color:#111827; line-height:1.6;">
      <table role="presentation" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 18px 0;">
            <p style="margin:0 0 10px 0;">Hi ${interviewerName},</p>
            <p style="margin:0;">You are scheduled to interview <strong>${candidateName}</strong> for the role <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
          </td>
        </tr>
      </table>

      <table role="presentation" style="width:100%; max-width:640px; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280; width:38%;">Date</td>
          <td style="padding:12px 16px;"><strong>${dateStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Start time</td>
          <td style="padding:12px 16px;"><strong>${timeStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Duration</td>
          <td style="padding:12px 16px;"><strong>${durationStr}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interview mode</td>
          <td style="padding:12px 16px;"><strong>${mode}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interviewer type</td>
          <td style="padding:12px 16px;"><strong>${interviewerTypeLabel}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">Interview type</td>
          <td style="padding:12px 16px;"><strong>${interviewTypeLabel}</strong></td>
        </tr>
        <tr>
          <td style="padding:12px 16px; background:#f9fafb; color:#6b7280;">${placeLabel}</td>
          <td style="padding:12px 16px;">${placeHtml}</td>
        </tr>
      </table>

      ${joinLink ? `
      <div style="margin:18px 0 10px 0;">
        <a href="${joinLink}" target="_blank" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;">Join Interview</a>
      </div>` : ''}

      ${loginCredentialsBlock}

      ${notes ? `<p style="margin:14px 0 0;"><strong>Notes for interviewer:</strong><br/>${String(notes).replace(/\n/g, '<br/>')}</p>` : ''}

      <p style="margin:16px 0 0;">Regards,<br/>The Hirex REC Team</p>
    </div>
    `.trim();

    const loginCredentialsText = isHumanType && hasLoginEmail && hasLoginPassword
        ? `Login details:
Username (Email): ${loginEmail}
Password: ${loginPassword}`
        : '';

    const text = `
Hi ${interviewerName},

You are scheduled to interview ${candidateName} for ${jobTitle} at ${companyName}.

Date: ${dateStr}
Start time: ${timeStr}
Duration: ${durationStr}
Interview mode: ${mode}
Interviewer type: ${interviewerTypeLabel}
Interview type: ${interviewTypeLabel}
${placeLabel}: ${place}
${joinLink ? `\nJoin link: ${joinLink}` : ''}
${loginCredentialsText ? `\n${loginCredentialsText}` : ''}
${notes ? `\nNotes for interviewer:\n${notes}` : ''}

Regards,
The Hirex REC Team
    `.trim();

    const template = await resolveTemplatePayload({
        reqContext,
        templateKey: EMAIL_TEMPLATE_KEYS.INTERVIEW_SCHEDULED_INTERVIEWER,
        variables: {
            interviewerName,
            candidateName,
            jobTitle,
            companyName,
            dateStr,
            timeStr,
            durationStr,
            mode,
            placeLabel,
            place,
            interviewerTypeLabel,
            interviewTypeLabel,
            notes: notes || '',
            loginUrl,
            loginEmail: loginEmail || '',
            loginPassword: loginPassword || '',
        },
        fallbackPayload: { subject, html, text },
        useClientTemplate: false,
    });

    return sendEmail({ to, ...template, reqContext });
}


