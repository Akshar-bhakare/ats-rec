import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';

import { getClientDbConn, getDBNameByEmail } from '../utils/clientDbUtils.js';
import { sendEmail } from '../services/eMailing/emailService.js';

dotenv.config();

const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const globalConn = await getClientDbConn(DEFAULT_DB_NAME);
const loginNotificationRecipients = [
    "akshara.swamy@hirexit.com",
    "akash.shendage@hirexit.com",
    "nikhilb@hirexit.com",
];
const excludedLoginDomains = ["aiselekt.com", "applycup.com", "hirexit.com"];

const getEmailDomain = (email) => {
    if (!email || typeof email !== "string") return "";
    const normalized = email.trim().toLowerCase();
    const atIndex = normalized.lastIndexOf("@");
    if (atIndex === -1) return "";
    return normalized.slice(atIndex + 1);
};

const isAiselektHost = (hostname) => {
    if (!hostname) return false;
    const host = String(hostname).trim().toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
    return (host === "aiselekt.com" || host.endsWith(".aiselekt.com")) || (host === "hirexit.com" || host.endsWith(".hirexit.com"));
};

const getRequestHostInfo = (req) => {
    const origin = req?.headers?.origin;
    if (origin) {
        try {
            const originUrl = new URL(origin);
            return { host: originUrl.hostname, source: "origin" };
        } catch {
            // ignore invalid origin
        }
    }

    const referer = req?.headers?.referer;
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            return { host: refererUrl.hostname, source: "referer" };
        } catch {
            // ignore invalid referer
        }
    }

    const hostHeader = req?.headers?.["x-forwarded-host"] || req?.headers?.host;
    if (hostHeader) {
        const host = String(hostHeader).split(",")[0].trim().split(":")[0];
        return { host, source: "host" };
    }

    return { host: "", source: "unknown" };
};

const getRequestIp = (req) => {
    const forwardedFor = req?.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }
    return req?.ip || '';
};

const verifyRecaptchaToken = async ({ token, remoteIp }) => {
    if (!RECAPTCHA_SECRET_KEY) {
        console.log('RECAPTCHA_SECRET_KEY is missing.');
        return false;
    }

    if (!token) {
        return false;
    }

    try {
        const payload = new URLSearchParams({
            secret: RECAPTCHA_SECRET_KEY,
            response: token,
        });

        if (remoteIp) {
            payload.set('remoteip', remoteIp);
        }

        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload.toString(),
        });

        if (!response.ok) {
            return false;
        }

        const result = await response.json();
        return result?.success === true;
    } catch (err) {
        console.log('reCAPTCHA verification error:', err?.message || err);
        return false;
    }
};

const validateRecaptchaOrReply = async (req, reply, actionOnFailure = null) => {
    const recaptchaToken =
        typeof req?.body?.recaptchaToken === 'string'
            ? req.body.recaptchaToken.trim()
            : '';

    const isValid = await verifyRecaptchaToken({
        token: recaptchaToken,
        remoteIp: getRequestIp(req),
    });

    if (isValid) {
        return true;
    }

    const responseBody = { message: 'reCAPTCHA verification failed' };
    if (actionOnFailure) {
        responseBody.action = actionOnFailure;
    } else {
        responseBody.error = 'reCAPTCHA verification failed';
    }

    reply.code(400).send(responseBody);
    return false;
};

const shouldNotifyLogin = (email, req) => {
    const domain = getEmailDomain(email);
    if (!domain || excludedLoginDomains.includes(domain)) return false;
    const { host } = getRequestHostInfo(req);
    return isAiselektHost(host);
};

const sendLoginNotification = async ({ subject, body }) => {
    try {
        await sendEmail({
            to: loginNotificationRecipients.join(","),
            subject,
            text: body,
            html: `<p>${body}</p>`,
            unsubscribeDisabled: true,
        });
    } catch (err) {
        console.log("Login notification email failed:", err?.message || err);
    }
};

export default async function authRoutes(fastify) {

    if (['development', 'local'].includes(process.env.NODE_ENV.toLowerCase())) {
        fastify.post('/register', async (req, reply) => {

            const existingUser = await globalConn.models['User'].findOne({ email: req?.body?.email });
            let newUser = existingUser;

            if (!existingUser) {
                newUser = await globalConn.models['User'].create({ ...req?.body });
            }

            const user = existingUser || newUser;

            return reply.code(201).send({ id: user._id, ...req?.body || {} });
        });
    }

    fastify.post('/login', async (req, reply) => {
        if (!(await validateRecaptchaOrReply(req, reply))) {
            return;
        }

        const { email, password } = req.body;

        let dbName = await getDBNameByEmail(email);

        const clientConn = await getClientDbConn(dbName);

        const user = await clientConn.models['User'].findOne({ email }).lean().exec();

        if (user && user.isArchived === true) {
            return reply.code(401).send({ error: 'Account is archived. Contact your admin.' });
        }

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }

        let allDetails = { ...user, dbName };

        if (user && user?.role !== 'ultra_admin') {
            const clientAdminDoc = await globalConn.models['ClientAdmin'].findOne({ user: user.client }).lean().exec();
            allDetails = { ...clientAdminDoc, clientAdminId: clientAdminDoc?._id, ...allDetails };
        }

        if (user && ['recruiter', 'manager'].includes(String(user?.role || '').toLowerCase())) {
            const recruiter = await clientConn.models['Recruiter']
                .findOne({ user: user._id })
                .lean()
                .exec();
            allDetails = { ...recruiter, recruiterId: recruiter?._id, ...allDetails };
        }

        const token = fastify.jwt.sign({ sub: user._id, client: user?.client, dbName });
        reply
            .setCookie('token', token)
            .send({ token, user: allDetails, dbName });

        if (user?.role === "client_admin" && shouldNotifyLogin(email, req)) {
            const { host } = getRequestHostInfo(req);
            const parts = [
                `Login successful`,
                `Email: ${email}`,
                host ? `Website: ${host}` : null,
            ].filter(Boolean);
            await sendLoginNotification({
                subject: "Login successful",
                body: parts.join("\n"),
            });
        }
    });

    function buildForgotPasswordMail(userName, otp) {
        const year = new Date().getFullYear();

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Password Reset OTP</title></head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0;">
  <table align="center" width="100%" style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <tr>
      <td style="padding: 20px; text-align: center; background: #007BFF; color: #ffffff; border-top-left-radius: 8px; border-top-right-radius: 8px;">
        <h2 style="margin: 0;">Password Reset Request</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px; color: #333333;">
        <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
        <p style="font-size: 16px;">
          We received a request to reset your password. Please use the One-Time Password (OTP) below to proceed:
        </p>
        <p style="text-align: center; margin: 30px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #007BFF;">${otp}</span>
        </p>
        <p style="font-size: 14px; color: #666;">
          This OTP is valid for the next <strong>10 minutes</strong>. Do not share it with anyone for your account's safety.
        </p>
        <p style="font-size: 14px; color: #666;">
          If you didn't request this, please ignore this email or contact our support immediately.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Regards,<br /><strong>Hirex REC Team</strong>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align: center; font-size: 12px; color: #999; padding: 15px; background: #f4f6f8; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
        © ${year} Hirex REC. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>`;

        const text = `Hello ${userName},

We received a request to reset your password.

Your One-Time Password (OTP) is: ${otp}

This code will expire in 10 minutes. Do not share it with anyone.

If you did not request this reset, you can safely ignore this email.

Regards,
Hirex REC Team
© ${year} Hirex REC. All rights reserved.`;

        return { html, text };
    }


    fastify.post("/password/change/send/otp/", async (req, reply) => {
        if (!(await validateRecaptchaOrReply(req, reply, "getEmail"))) {
            return;
        }

        const { email } = req.body;
        let dbName = await getDBNameByEmail(email);

        const clientConn = await getClientDbConn(dbName);

        const user = await clientConn.models['User'].findOne({ email });

        if (!user) return reply.code(404).send({ message: "User not found", action: "getEmail" });

        // generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const hash = await bcrypt.hash(otp, 10);

        // store in user record
        user.resetOtpHash = hash;
        user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        user.resetOtpUsed = false;
        // Usage
        const { html, text } = buildForgotPasswordMail(user.firstName + " " + user.lastName, otp);

        await sendEmail({
            to: email,
            subject: "Your Password Reset OTP - Hirex REC",
            html,
            text,
            reqContext: {
                conn: clientConn,
                dbName,
                client: user?.client,
            },
        });

        await user.save();

        // TODO: send OTP via email/SMS
        // console.log("OTP (for testing):", otp);

        return reply.send({ message: "OTP sent to your registered email/phone", action: "getOtp" });
    });

    fastify.post("/password/change/verify/otp/", async (req, reply) => {
        if (!(await validateRecaptchaOrReply(req, reply, "getOtp"))) {
            return;
        }

        const { email, otp } = req.body;

        let dbName = await getDBNameByEmail(email);

        const clientConn = await getClientDbConn(dbName);

        const user = await clientConn.models['User'].findOne({ email });

        if (!user) return reply.code(404).send({ message: "User not found", action: "getEmail" });

        if (!user.resetOtpHash || user.resetOtpUsed || user.resetOtpExpiry < new Date()) {
            return reply.code(400).send({ message: "OTP expired or invalid", action: "getEmail" });
        }

        const isMatch = await bcrypt.compare(otp, user.resetOtpHash);
        if (!isMatch) return reply.code(400).send({ message: "Incorrect OTP", action: "getOtp" });

        // OTP is valid → mark it as verified (but not yet used for password reset)
        user.resetOtpVerified = true;  // add this field in schema
        await user.save();

        return reply.send({ message: "OTP verified successfully. You may now reset your password.", action: "getNewPassword" });
    });

    fastify.post("/password/change/new/", async (req, reply) => {
        if (!(await validateRecaptchaOrReply(req, reply, "getNewPassword"))) {
            return;
        }

        const { email, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) return reply.code(404).send({ message: "New Password and Cofirm Password does not match..." });

        let dbName = await getDBNameByEmail(email);

        const clientConn = await getClientDbConn(dbName);

        const user = await clientConn.models['User'].findOne({ email });

        if (!user) return reply.code(404).send({ message: "User not found", action: "getEmail" });

        if (!user.resetOtpVerified || user.resetOtpExpiry < new Date()) {
            return reply.code(400).send({ message: "OTP verification required or expired", action: "getEmail" });
        }

        // Update password
        user.password = newPassword; // pre-save hook will hash it
        user.resetOtpVerified = false;
        user.resetOtpUsed = true;
        user.resetOtpHash = null;
        user.resetOtpExpiry = null;

        await user.save();

        return reply.send({ message: "Password updated successfully", action: "success" });
    });


    fastify.get(
        '/profile',
        { preHandler: fastify.authenticate },
        async (req, reply) => {
            const userId = req.user.sub;
            const user = await req.conn.models['User'].findById(userId, '-password').lean().exec();

            if (user?.isArchived === true) {
                return reply.code(401).send({ error: 'Account is archived. Contact your admin.' });
            }

            let allDetails = { ...user, dbName: req.dbName };

            if (user && user?.role !== 'ultra_admin') {
                const clientAdminDoc = await globalConn.models['ClientAdmin'].findOne({ user: user.client }).lean().exec();
                allDetails = { ...clientAdminDoc, clientAdminId: clientAdminDoc?._id, ...allDetails };
            }

            if (user && ['recruiter', 'manager'].includes(String(user?.role || '').toLowerCase())) {
                const recruiter = await req.conn.models['Recruiter'].findOne({ user: user._id }).lean().exec();
                allDetails = { ...recruiter, recruiterId: recruiter?._id, ...allDetails };

            }

            return reply.send(allDetails);
        }
    );
}



// sendEmail({
//     to: [
//         "akashvshendage@applycup.com",
//         // "hr8@applycup.com",
//         // "sagar.khokad@hirexit.com",
//         // "vaishnavi.chintawar@hirexit.com",
//         // "nikhilb@hirexit.com",
//     ],
//     subject: "Test Mail Hirex REC",
//     html: "<p>To test the mailing service from ApplyCup's hirexit.ai</p>",
//     text: "To test the mailing service from webapp...",
// }).then(res => {
//     console.log(
//         "Email sending response: ", res
//     );
// }).catch(err => {
//     console.log(
//         "Error in email sending: ", err
//     );

// }).finally(() => {
//     console.log(
//         "Email sending proccess finished..."
//     );

// });
