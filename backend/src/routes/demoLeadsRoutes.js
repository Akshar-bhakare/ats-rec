import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { getClientDbConn } from '../utils/clientDbUtils.js';
import { sendEmail } from '../services/eMailing/emailService.js';



dotenv.config();
const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME;
const globalConn = await getClientDbConn(DEFAULT_DB_NAME);
const notificationRecipients = [
    "nikhilb@hirexit.com",
    "ruchita.chavan@hirexit.com",
    "akash.shendage@hirexit.com",
];
const freeDomains = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "aol.com",
    "icloud.com",
    "protonmail.com",
    "zoho.com",
    "gmx.com",
    "yandex.com",
    "mail.com",
    "live.com",
    "msn.com",
    "me.com",
    "inbox.com",
    "fastmail.com",
    "tutanota.com",
    "mail.ru",
    "yahoo.co.uk",
    "yahoo.co.in",
    "rediffmail.com",
    "qq.com",
    "naver.com",
    "daum.net",
    "hanmail.net"
];
const internalDomains = ["applycup.com", "aiselekt.com", "hirexit.com"];

const shouldNotifyLead = (email) => {
    if (!email || typeof email !== "string") return false;
    const normalized = email.trim().toLowerCase();
    const atIndex = normalized.lastIndexOf("@");
    if (atIndex === -1) return false;
    const domain = normalized.slice(atIndex + 1);
    if (!domain) return false;
    if (freeDomains.includes(domain)) return false;
    if (internalDomains.some((internal) => domain === internal || domain.endsWith(`.${internal}`))) return false;
    return true;
};

export const sendLeadNotification = async ({ subject, body }) => {
    try {
        await sendEmail({
            to: notificationRecipients.join(","),
            subject,
            text: body,
            html: `<p>${body}</p>`,
            unsubscribeDisabled: true,
        });
    } catch (err) {
        console.log("Lead notification email failed:", err?.message || err);
    }
};


export default async function demoLeadsRoutes(fastify) {

    function buildEmailVerifyMail(userName, otp) {
        const year = new Date().getFullYear();

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Email Verification OTP</title></head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0;">
  <table align="center" width="100%" style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <tr>
      <td style="padding: 20px; text-align: center; background: #007BFF; color: #ffffff; border-top-left-radius: 8px; border-top-right-radius: 8px;">
        <h2 style="margin: 0;">Email Verification Request</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px; color: #333333;">
        <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
        <p style="font-size: 16px;">
          We received a request to verify your email. Please use the One-Time Password (OTP) below to proceed:
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

We received a request to verify your email.

Your One-Time Password (OTP) is: ${otp}

This code will expire in 10 minutes. Do not share it with anyone.

If you did not request this verification, you can safely ignore this email.

Regards,
Hirex REC Team
© ${year} Hirex REC. All rights reserved.`;

        return { html, text };
    }

    fastify.post("/email/send/otp/", async (req, reply) => {
        const { email, demoOf } = req.body;
        const demoLead = await globalConn.models['DemoLeads']?.findOne?.({ email, demoOf }) || await globalConn.models['DemoLeads'].create({ ...(req?.body || {}) });

        if (!demoLead) return reply.code(404).send({ message: "Record not found.", action: "getEmail" });

        // generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const hash = await bcrypt.hash(otp, 10);

        // store in user record
        demoLead.verifyEmailOtpHash = hash;
        demoLead.verifyEmailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        demoLead.verifyEmailOtpUsed = false;
        // Usage
        const { html, text } = buildEmailVerifyMail(demoLead.firstName + " " + demoLead.lastName, otp);

        await sendEmail({
            to: email,
            subject: "Your Email Verification OTP - Hirex REC",
            html,
            text,
            reqContext: {
                conn: globalConn,
                dbName: DEFAULT_DB_NAME,
            },
        });

        if (shouldNotifyLead(email)) {
            const name = [demoLead.firstName, demoLead.lastName].filter(Boolean).join(" ").trim();
            const parts = [
                `OTP req: ${email}`,
                name ? `name=${name}` : null,
                demoOf ? `demoOf=${demoOf}` : null,
            ].filter(Boolean);
            sendLeadNotification({
                subject: "Demo lead Initiate",
                body: parts.join(" | "),
            });
        }

        // TODO: send OTP via email/SMS
        // console.log("OTP (for testing):", otp);

        await demoLead.save();


        return reply.send({ message: "OTP sent to your registered email.", action: "getOtp" });
    });

    fastify.post("/email/verify/otp/", async (req, reply) => {
        const { email, otp, demoOf } = req.body;

        const demoLead = await globalConn.models['DemoLeads'].findOne({ email, demoOf });

        if (!demoLead) return reply.code(404).send({ message: "Record not found.", action: "getEmail" });

        if (!demoLead.verifyEmailOtpHash || demoLead.verifyEmailOtpUsed || demoLead.verifyEmailOtpExpiry < new Date()) {
            return reply.code(400).send({ message: "OTP expired or invalid", action: "getEmail" });
        }

        const isMatch = await bcrypt.compare(otp, demoLead.verifyEmailOtpHash);
        if (!isMatch) return reply.code(400).send({ message: "Incorrect OTP", action: "getOtp" });

        // OTP is valid → mark it as verified (but not yet used for Email Verification)
        demoLead.verifyEmailOtpVerified = true;  // add this field in schema
        await demoLead.save();

        if (shouldNotifyLead(email)) {
            const name = [demoLead.firstName, demoLead.lastName].filter(Boolean).join(" ").trim();
            const parts = [
                `OTP ok: ${email}`,
                name ? `name=${name}` : null,
                demoOf ? `demoOf=${demoOf}` : null,
            ].filter(Boolean);
            sendLeadNotification({
                subject: "Demo lead OTP Verified",
                body: parts.join(" | "),
            });
        }

        return reply.send({ message: "OTP verified successfully. You may now continue your journey.", action: "getNewPassword" });
    });

}



// await sendLeadNotification({
//     subject: "Demo lead Notification - Trial",
//     body: "Demo Lead notification try, you will receive notifications of HirexIT AI demo from system now onwards... - Akash V Shendage",
// });


// sendEmail({
//     to: [
//         "akash.shendage@hirexit.com",
//         // "sagar.khokad@hirexit.com",
//         // "vaishnavi.chintawar@hirexit.com",
//     ],
//     subject: "Mail ApplyCup",
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
