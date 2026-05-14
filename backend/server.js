import fs from 'fs';
import dotenv from 'dotenv';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import path, { dirname, join } from 'path';

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import session from '@fastify/session';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import staticPlugin from '@fastify/static'
import jwtPlugin from '@fastify/jwt';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import formBody from '@fastify/formbody';

import { getClientDbConn } from './src/utils/clientDbUtils.js';
import { getRequestTimeZone } from './src/utils/timeUtils.js';

import userRoutes from './src/routes/userRoutes.js';
import clientAdminRoutes from './src/routes/clientAdminRoutes.js';
import recruiterRoutes from './src/routes/recruiterRoutes.js';
import candidateRoutes, { candidateRoutesWithoutAuth } from './src/routes/candidateRoutes.js';

import authRoutes from './src/routes/authRoutes.js';
import companyRoutes from './src/routes/companyRoutes.js';
import eventRoutes from './src/routes/eventRoutes.js';
import jobRoutes, { jobRoutesWithoutAuth } from './src/routes/jobRoutes.js';
import scriptRoutes from './src/routes/scriptRoutes.js';
import stageRoutes from './src/routes/stageRoutes.js';
import settingRoutes from './src/routes/settingRoutes.js';
import conversationRoutes, { conversationRoutesWithoutAuth } from './src/routes/conversationRoutes.js';
import aiCallRoutes, { aiCallRoutesWithoutAuth } from './src/routes/aiCallRoutes.js';
import { telnyxInboundRoutes, plivoInboundRoutes } from './src/routes/inboundCallRoutes.js';
import inboundCallScriptRoutes from './src/routes/inboundCallScriptRoutes.js';
import inboundLeadRoutes from './src/routes/inboundLeadRoutes.js';
import conversationSummaryRoutes from './src/routes/conversationSummaryRoutes.js';
import candidateATSRoutes from './src/routes/candidateATSRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import assistantRoutes from './src/routes/assistantRoutes.js';
import { timeOutSetterForSchedulersAfterDeploy } from './SystemChecksAndInitiators/schedulers.js';
import { aiAgentAssistantRoutes, aiAgentAssistantRoutesWithoutAuth } from './src/routes/aiAgentRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import notificationPreferenceRoutes from './src/routes/notificationPreferenceRoutes.js';
import interviewScheduleRoutes from './src/routes/VirtualInterview/interviewScheduleRoutes.js';
import emailRoutes from './src/routes/emailRoutes.js';
import relevancyRoutes from './src/routes/relevancyRoutes.js';
import candidateFromJobSocialRoutes from './src/routes/candidateFromJobSocialRoutes.js';
import demoLeadsRoutes from './src/routes/demoLeadsRoutes.js';
import demoMeetingRoutes from './src/routes/demoMeetingRoutes.js';
import aiRoutes from './src/routes/VirtualInterview/aiInterviewRoutes.js';
import { initWhatsApp } from './src/loaders/whatsAppLoader.js';
import WhatsAppRoutes from './src/routes/whatsAppRoutes.js';
import webrtcRoomRoutes from './src/routes/VirtualInterview/webrtcRoomRoutes.js';
import recordingRoutes from './src/routes/VirtualInterview/recordingRoutes.js';



// Code Judge Routes
import problemRoutes from './src/routes/codeJudgeRoutes/problemRoutes.js';
import testCaseRoutes from './src/routes/codeJudgeRoutes/testCaseRoutes.js';
import submissionRoutes from './src/routes/codeJudgeRoutes/submissionRoutes.js';
import executionAdapterRoutes from './src/routes/codeJudgeRoutes/executionAdapterRoutes.js';
import languageRoutes from './src/routes/codeJudgeRoutes/languageRoutes.js';
import emailTemplateRoutes from './src/routes/emailTemplateRoutes.js';
import emailUnsubscribeRoutes from './src/routes/emailUnsubscribeRoutes.js';
import humeVoiceRoutes from './src/routes/humeVoiceRoutes.js';
import interviewReminderRoutes from './src/routes/interviewReminderRoutes.js';
import { initInterviewReminderScheduler } from './SystemChecksAndInitiators/interviewReminderScheduler.js';

// import './src/services/aiCalling/aiCallOrchestrationTest.js';
// import './src/utils/whatsAppUtilsTest.js';



const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const staticPath = join(__dirname, 'static');

dotenv.config();

// process.env.GOOGLE_APPLICATION_CREDENTIALS = join(__dirname, 'src/keys/conversation-stt-tts-key.json');
process.env.GOOGLE_APPLICATION_CREDENTIALS = join(__dirname, 'src/keys/hirexit-ai-webapp-key.json');

const hostPORT = process.env.PORT || 8080;

const fastify = Fastify({
    bodyLimit: 10 * 200 * 1024 * 1024,
    logger: {
        timestamp: () => {
            const ts = new Date().toLocaleString('en-US', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });

            return `,"time":"${ts}"`;
        },

        // you can still control what fields to include
        levelFirst: true,
        // omit pid/hostname if you like:
        // serializers: { pid: () => undefined, hostname: () => undefined },
    }
});

const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME;

fastify.decorateRequest('clientTimezone', null);

fastify.addHook('onRequest', async (req) => {
    req.clientTimezone = getRequestTimeZone(req);
});

// Security headers
await fastify.register(helmet, {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"],
            objectSrc: ["'none'"],

            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://*.googleapis.com",
                "https://googleapis.com",
                "https://*.gstatic.com",
                "https://gstatic.com",
                "https://*.google.com",
                "https://google.com",
                "https://*.jsdelivr.net",
                "https://jsdelivr.net",
                "https://googletagmanager.com",
                "https://*.googletagmanager.com",
                "https://google-analytics.com",
                "https://*.google-analytics.com",
            ],

            frameSrc: [
                "'self'",
                "blob:",
                "https://*.googleapis.com",
                "https://*.googleapis.com",
                "https://*.gstatic.com",
                "https://*.google.com",
            ],

            scriptSrcAttr: ["'none'"],
            connectSrc: [
                "'self'",
                "ws:",
                "wss:",
                "https://*.googleapis.com",
                "https://googleapis.com",
                "https://*.gstatic.com",
                "https://gstatic.com",
                "https://*.google.com",
                "https://google.com",
                "https://*.jsdelivr.net",
                "https://jsdelivr.net",
                "https://tfhub.dev",
                "https://kaggle.com",
                "https://*.kaggle.com",
                "https://googletagmanager.com",
                "https://*.googletagmanager.com",
                "https://google-analytics.com",
                "https://*.google-analytics.com",
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://*.googleapis.com",
                "https://*.gstatic.com",
                "https://images.unsplash.com",
                "https://i.pravatar.cc",
                "https://googletagmanager.com",
                "https://*.googletagmanager.com",
                "https://google-analytics.com",
                "https://*.google-analytics.com",
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
            ],
            fontSrc: [
                "'self'",
                "data:",
                "https://fonts.gstatic.com",
            ],
            mediaSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://storage.googleapis.com",
                "https://docs.google.com",
            ],
            workerSrc: ["'self'", "blob:"],
        },
    },
});

// Register plugins
await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET,
    parseOptions: {}
});

// Session store (stateful CSRF)
await fastify.register(session, {
    secret: process.env.SESSION_SECRET,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
})

await fastify.register(csrf, { sessionPlugin: '@fastify/session' });

await fastify.register(jwtPlugin, {
    secret: process.env.JWT_SECRET,
    cookie: { cookieName: 'token', signed: false },
    sign: {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
});

// Ensure AiSelektTmpMedia exists
export const tmpMediaDir = join(tmpdir(), 'AiSelektTmpMedia');
if (!fs.existsSync(tmpMediaDir)) {
    fs.mkdirSync(tmpMediaDir, { recursive: true });
    console.log('Created directory:', tmpMediaDir);
}

export const ttsMediaTempDir = path.join(tmpMediaDir, 'AiSelektTtsMedia');
if (!fs.existsSync(ttsMediaTempDir)) {
    fs.mkdirSync(ttsMediaTempDir, { recursive: true });
    console.log('Created directory:', ttsMediaTempDir);
}

await fastify.register(multipart, {
    uploadDir: tmpMediaDir,
    attachFieldsToBody: true,
    limits: {
        fileSize: 500 * 1024 * 1024,   // max file size (5 MB)
        files: 51,                    // max # of files per request
    }
});

await fastify.register(websocket);
await fastify.register(formBody, { bodyLimit: 10 * 200 * 1024 * 1024 });

if (process.env?.NODE_ENV === 'development') {

    fastify.addHook('onSend', (request, reply, payload, done) => {

        const contentType = reply.getHeader('content-type');
        if (typeof contentType === 'string' && contentType.includes('application/json')) {
            const size = Buffer.isBuffer(payload)
                ? payload.length
                : Buffer.byteLength(payload);

            const sizeMB = (size / (1024 * 1024)).toFixed(2)
            request.log.info(`Default Response payload size is 1 Mega Bytes(MB)`);
            request.log.info(`Response payload size: ${sizeMB} Mega bytes(MB)`);
            request.log.info(`Response payload size: ${(size / 1024).toFixed(2)} Kilo bytes(KB)`);
        }

        done(null, payload);
    });

}

// Auth decorator
fastify.decorate('authenticate', async (req, reply) => {
    try {

        const jwtRes = await req.jwtVerify();

        if (!jwtRes?.dbName) {
            console.error('[AUTH-DEBUG] No dbName in JWT');
            try {
                throw this?.httpErrors?.unauthorized('Error in token parsing, try login again...');
            } catch {
                throw new Error("Unauthorised...");
            }
        }

        req.dbName = jwtRes?.dbName || DEFAULT_DB_NAME;
        req.conn = await getClientDbConn(jwtRes?.dbName || DEFAULT_DB_NAME);

        const user = await req.conn.models['User'].findById(jwtRes.sub).lean().exec();

        if (!user) {
            console.error('[AUTH-DEBUG] User/Candidate not found in DB:', jwtRes.sub);
            try {
                throw this?.httpErrors?.unauthorized('User not found...');
            } catch {
                throw new Error("Unauthorised...");
            }
        }
        const originalRole = user?.role;
        const effectiveRole = originalRole === 'manager' ? 'client_admin' : originalRole;
        const authUser = { ...user, role: effectiveRole, originalRole };
        const globalConn = await getClientDbConn(DEFAULT_DB_NAME);
        let allDetails = authUser;

        if (authUser && authUser?.role !== 'ultra_admin') {
            const clientAdminDoc = await globalConn.models['ClientAdmin'].findOne({ user: user.client }).lean().exec();
            allDetails = { ...clientAdminDoc, clientAdminId: clientAdminDoc?._id, ...allDetails };
        }

        if (['recruiter', 'manager'].includes(String(originalRole || '').toLowerCase())) {
            const recruiter = await req.conn.models['Recruiter'].findOne({ user: user._id }).lean().exec() || {};
            allDetails = { ...recruiter, recruiterId: recruiter?._id, ...allDetails };

        }
        // merge DB record + token payload
        req.user = { ...allDetails, ...authUser, ...jwtRes, };

        // pick whichever client field exists
        req.client = user?.clientId || user?.client || user?._id;

    } catch (err) {
        fastify.log.error('[AUTH-ERROR] ' + err.message);
        return reply.code(401).send({ error: 'Unauthorized', details: err.message });
    }
});


const whatsAppAPI = initWhatsApp();

fastify.decorate("whatsapp", whatsAppAPI);

// whatsAppAPI.sendTemplateMessage("91907586735", "initial_msg_v2");
// whatsAppAPI.sendTemplateMessage("919359272011", "initial_msg_v2");

// User routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(userRoutes, { prefix: '/api/users' });

await fastify.register(demoLeadsRoutes, { prefix: '/api/demo/leads' });
await fastify.register(demoMeetingRoutes, { prefix: '/api/demo-meetings' });

// Client Admin Routes
await fastify.register(clientAdminRoutes, { prefix: '/api/admins' });

// Recruiter Routes
await fastify.register(recruiterRoutes, { prefix: '/api/recruiter' });

// Company Routes
await fastify.register(companyRoutes, { prefix: '/api/companies' });

await fastify.register(eventRoutes, { prefix: '/api/events' });

// Job Routes
await fastify.register(jobRoutes, { prefix: '/api/jobs' });
await fastify.register(jobRoutesWithoutAuth, { prefix: '/api/jobs' });

// Script Routes
await fastify.register(scriptRoutes, { prefix: '/api/scripts' });

// Hume AI Voice Routes
await fastify.register(humeVoiceRoutes, { prefix: '/api/hume' });

// Candidate Routes
await fastify.register(candidateRoutes, { prefix: '/api/candidates' });
await fastify.register(candidateRoutesWithoutAuth, { prefix: '/api/candidates' });
await fastify.register(candidateFromJobSocialRoutes, { prefix: '/api/candidates/job/social' });
await fastify.register(candidateATSRoutes, { prefix: '/api/candidates/ats' });

// Stage Routes
await fastify.register(stageRoutes, { prefix: '/api/stages' });

// Settings Routes
await fastify.register(settingRoutes, { prefix: '/api/settings' });
await fastify.register(emailTemplateRoutes, { prefix: '/api/email-templates' });

// AI Interview Routes
await fastify.register(aiRoutes, { prefix: '/api/ai' });

// Conversation Routes
await fastify.register(conversationRoutes, { prefix: '/api/conversations' });
await fastify.register(conversationRoutesWithoutAuth, { prefix: '/api/conversations' });
await fastify.register(conversationSummaryRoutes, { prefix: '/api' });

// AI Call Routes
await fastify.register(aiCallRoutesWithoutAuth, { prefix: '/api/ai/call' });
await fastify.register(aiCallRoutes, { prefix: '/api/ai/call' });
await fastify.register(inboundCallScriptRoutes, { prefix: '/api/inbound-call-scripts' });
// Inbound Call Routes (no auth — telephony webhooks)
// Telnyx webhook URL:  POST https://yourdomain.com/webhooks/telnyx/voice
// Plivo answer URL:    POST https://yourdomain.com/api/ai/call/inbound/plivo/
// Plivo hangup URL:    POST https://yourdomain.com/api/ai/call/inbound/plivo/hangup/
await fastify.register(telnyxInboundRoutes, { prefix: '/webhooks/telnyx' });
await fastify.register(plivoInboundRoutes, { prefix: '/api/ai/call/inbound/plivo' });
await fastify.register(inboundLeadRoutes, { prefix: '/api/inbound-leads' });
await fastify.register(WhatsAppRoutes, { prefix: '/api/whatsapp' });

await fastify.register(authRoutes, { prefix: '/api/auth/ats/integration/v1' });
await fastify.register(companyRoutes, { prefix: '/api/companies/ats/integration/v1' });
await fastify.register(jobRoutes, { prefix: '/api/jobs/ats/integration/v1' });
await fastify.register(scriptRoutes, { prefix: '/api/scripts/ats/integration/v1' });
await fastify.register(candidateRoutes, { prefix: '/api/candidates/ats/integration/v1' });
await fastify.register(candidateRoutesWithoutAuth, { prefix: '/api/candidates/ats/integration/v1' });
await fastify.register(conversationRoutes, { prefix: '/api/conversations/ats/integration/v1' });
await fastify.register(aiCallRoutesWithoutAuth, { prefix: '/api/ai/call/ats/integration/v1' });
await fastify.register(aiCallRoutes, { prefix: '/api/ai/call/ats/integration/v1' });
await fastify.register(WhatsAppRoutes, { prefix: '/api/whatsapp/ats/integration/v1' });


await fastify.register(webrtcRoomRoutes, { prefix: '/api/webrtc' });
await fastify.register(recordingRoutes, { prefix: '/api/ai/recording-auth' });

// Notification Routes
await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
await fastify.register(notificationPreferenceRoutes, { prefix: '/api/notification-preferences' });

// Inetrview Schedular Routes
await fastify.register(interviewScheduleRoutes, { prefix: '/api/interviewschedules' });


await fastify.register(emailRoutes, { prefix: '/api/emails' });
await fastify.register(emailUnsubscribeRoutes, { prefix: '/api/email-unsubscribe' });

// Interview Reminder & Rescheduling Routes
await fastify.register(interviewReminderRoutes, { prefix: '/api/interview-reminders' });


// Dashboard and Global UI Routes
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });

await fastify.register(assistantRoutes, { prefix: '/api/assistant' });
await fastify.register(aiAgentAssistantRoutes, { prefix: '/api/ai/agent/' });
await fastify.register(aiAgentAssistantRoutesWithoutAuth, { prefix: '/api/ai/agent/' });


await fastify.register(relevancyRoutes, { prefix: '/api/relevancyrecords/' });

// Code Judge Routes

await fastify.register(problemRoutes, { prefix: '/api/codejudge' });
await fastify.register(testCaseRoutes, { prefix: '/api/codejudge' });
await fastify.register(submissionRoutes, { prefix: '/api/codejudge' });
await fastify.register(executionAdapterRoutes, { prefix: '/api/codejudge' });
await fastify.register(languageRoutes, { prefix: '/api/codejudge' });

if (['development', 'local'].includes(process?.env?.NODE_ENV)) {
    fastify.get('/api/timeout/setter/schedules/calls/', async (req, reply) => {
        try {
            await timeOutSetterForSchedulersAfterDeploy();
            return reply.code(200).send({
                message: "System checks via HTTP request excuted successfully..."
            })
        } catch (err) {
            return reply.code(400).send({ message: "Error in executing system checks...", details: { errors: err } });
        }
    });

}

await fastify.register(staticPlugin, {
    root: staticPath,
    prefix: '/static/'
})

for (const [route, fileName, contentType] of [
    ['/robots.txt', 'robots.txt', 'text/plain; charset=utf-8'],
    ['/sitemap.xml', 'sitemap.xml', 'application/xml; charset=utf-8'],
    ['/BingSiteAuth.xml', 'BingSiteAuth.xml', 'application/xml; charset=utf-8'],
    ['/favicon.ico', 'favicon.ico', 'image/x-icon'],
]) {
    fastify.get(route, async (req, reply) => {
        const filePath = path.join(__dirname, 'static', fileName);

        if (!fs.existsSync(filePath)) {
            return reply.code(404).send({ message: `${fileName} not found` });
        }

        return reply.type(contentType).send(contentType.includes("utf-8") ? fs.readFileSync(filePath, 'utf8') : fs.readFileSync(filePath));
    });
}

fastify.get('/*', async (req, reply) => {
    const indexPath = path.join(__dirname, 'html_templates/index.html')
    let html = fs.readFileSync(indexPath, 'utf8')

    const token = reply.generateCsrf();

    const injection = `<meta name="csrf-token" content="${token}">`
    html = html.replace('</head>', `${injection}</head>`)

    reply.type('text/html').send(html)
})

// Language sync removed - fetching dynamically from Judge0

// System checks
if (['production', 'development'].includes(process?.env?.NODE_ENV)) {
    timeOutSetterForSchedulersAfterDeploy();
}

process.on('uncaughtException', (err) => {
    console.log('❌ [Server] Uncaught Exception: ', err);
});

process.on('unhandledRejection', (err) => {
    console.log('❌ [Server] Unhandled Rejection: ', err);
});

async function bootstrapBackgroundWork() {

    try {
        if (['production', 'development'].includes(process.env.NODE_ENV)) {
            await timeOutSetterForSchedulersAfterDeploy();
        }
    } catch (err) {
        fastify.log.error({ err }, '❌ Scheduler bootstrap failed');
    }

    try {
        if (['production', 'development'].includes(process.env.NODE_ENV)) {
            await initInterviewReminderScheduler();
        }
    } catch (err) {
        fastify.log.error({ err }, '❌ Interview Reminder Scheduler bootstrap failed');
    }
}

try {
    const hostPORT = Number(process.env.PORT || 8080);
    const address = await fastify.listen({ host: '0.0.0.0', port: hostPORT });
    fastify.log.info(`✅ Server listening at ${address}`);

    // Run long init in background (don’t block startup readiness)
    bootstrapBackgroundWork();

} catch (err) {
    fastify.log.error({ err }, '❌ Failed to start server');
    process.exit(1);
}



// try {
//     fastify.listen({ host: '0.0.0.0', port: hostPORT });
//     fastify.log.info('✅ Server listening on http://0.0.0.0:' + hostPORT);
// } catch (err) {
//     fastify.log.error(err);
// }
