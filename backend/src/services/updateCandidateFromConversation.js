import https from 'https';
import { chatCompletionByOpenAI } from '../utils/aiChatCompletions.js';
import { sendEmail } from '../services/eMailing/emailService.js';
import { getClientDbConn } from '../utils/clientDbUtils.js';
import { getNotificationPreferences, isInAppNotificationEnabled } from '../utils/notificationPreferences.js';

const niceLabel = role =>
    role === 'assistant' || role === 'ai'
        ? 'Recruiter'
        : role === 'user' || role === 'candidate'
            ? 'Candidate'
            : role;

async function getWavDuration(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, res => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }

                const headerChunks = [];
                let bytesCollected = 0;

                res.on('data', chunk => {
                    if (bytesCollected < 44) {
                        headerChunks.push(chunk);
                        bytesCollected += chunk.length;
                    }
                    if (bytesCollected >= 44) {
                        res.destroy();
                        const header = Buffer.concat(headerChunks).subarray(0, 44);

                        const sampleRate = header.readUInt32LE(24);
                        const byteRate = header.readUInt32LE(28);
                        const dataChunkSize = header.readUInt32LE(40);

                        if (!sampleRate || !byteRate || !dataChunkSize) {
                            return reject(new Error('Invalid WAV header'));
                        }

                        const durationSeconds = dataChunkSize / byteRate;
                        const mins = Math.floor(durationSeconds / 60);
                        const secs = Math.floor(durationSeconds % 60);
                        const formatted =
                            String(mins).padStart(2, '0') +
                            ':' +
                            String(secs).padStart(2, '0') +
                            ' mins';
                        return resolve(formatted);
                    }
                });

                res.on('error', reject);
            })
            .on('error', reject);
    });
}

export async function updateCandidateFromConversation(conversationId, req, callUUID, allMsgs = undefined) {
    console.log(
        `[updateCandidateFromConversation] start convId=${conversationId} callUUID=${callUUID || 'n/a'}`
    );
    const conv = await req.conn.models['Conversation']
        .findById(conversationId)
        .lean()
        .exec();

    if (!conv?.messages?.length) {
        console.warn(
            `[updateCandidateFromConversation] Conversation missing or empty convId=${conversationId}`
        );
        throw new Error('Conversation not found or has no messages');
    }

    console.log(
        `[updateCandidateFromConversation] loaded convId=${conv?._id} candidate=${conv?.candidateId || 'n/a'} job=${conv?.jobId || 'n/a'} audio_url=${conv?.audio_url || 'n/a'} messages=${conv?.messages?.length || 0}`
    );
    if (!conv?.audio_url) {
        console.warn(
            `[updateCandidateFromConversation] audio_url missing convId=${conv?._id} callUUID=${callUUID || 'n/a'}`
        );
    }

    const candidateConvMsgs = allMsgs || (conv?.messages || []);

    // Fetch extra question (if any) configured on the script for this job, so we can capture its answer.
    let extraQuestionText = null;
    try {
        const scriptDoc = await req.conn.models['Script']
            .findOne({ jobId: conv.jobId, isArchived: false })
            .select('extraQuestion')
            .lean()
            .exec();
        extraQuestionText = scriptDoc?.extraQuestion || null;
    } catch (e) {
        console.warn('[updateCandidateFromConversation] failed to load script extraQuestion:', e?.message || e);
    }

    const normalizedExtraQuestionText =
        typeof extraQuestionText === 'string' ? extraQuestionText.trim() : '';
    const includeExtraQuestionExtraction = Boolean(normalizedExtraQuestionText);

    const extraQuestionPromptBlock = includeExtraQuestionExtraction
        ? `
extraQuestionAnswer: string or null.
  - Configured extra question: ${JSON.stringify(normalizedExtraQuestionText)}.
  - Extract only the candidate's explicit answer to this question.
  - If recruiter asked a paraphrased or rewritten form of this question, that still counts.
  - If asked multiple times, use the most recent candidate answer.
  - If not asked or not answered, return null.
`
        : '';
    const systemPrompt = `
You are an analyst extracting ONLY facts explicitly stated in the recruiter-candidate conversation.
Return VALID JSON (no Markdown, no extra keys) with these keys:

experience: object or null. Format { "total": "<NUMBER> years", "<skill>": "<NUMBER> years", ... }.
  - Keep numbers/units as spoken (accept ranges like "3-5 years" verbatim). If nothing stated, null.

currentCTC / expectedCTC: object or null.
  - Format { "amount": <number>, "currency": "<CODE>", "unit": "per_month|per_year|per_hour|lpa|k" } using the candidate's wording.
  - If any piece is missing or ambiguous, set the whole field to null.

noticePeriod: string or null. Use exact phrasing (e.g., "30 days", "immediate", "serving 15 days").

location: string or null. City + state/country if stated; else null.

company: string or null. Current employer stated by candidate; else null.

jobOffers: boolean or null. true if explicit offer(s) mentioned; false if explicitly none; null if unclear.

communicationRating: number 1-10 or null. Rubric: 10 very clear & polite; 7 clear minor issues; 5 understandable with effort; 3 hard to follow; 1 unintelligible. If not enough signal, null.

interested: one of true | false | "Follow Up" | "".
  - true: explicit interest/confirmation.
  - false: explicit rejection/not interested.
  - "Follow Up": no candidate speech, busy/meeting, call dropped/network issue, asks to talk later, or stance unclear where follow-up helps.
  - "": interest not addressed.

${extraQuestionPromptBlock}

PanCardNumber: string or null. Only extract if it matches ^[A-Z]{5}[0-9]{4}[A-Z]$ (uppercase, no spaces); else null.

STRICT RULES:
- Do NOT guess or infer; if a value is not explicitly in candidate/user messages, return null (or "" per interested rules).
- Use only this conversation; ignore outside knowledge.
- If multiple values conflict, use the most recent candidate statement.
- JSON only, no markdown or explanations.
`.trim();

    // Build a clean, human-readable conversation text for the AI extractor.
    // Raw JSON objects are hard for the model to parse; plain "Role: text" lines are much easier.
    const conversationText = candidateConvMsgs
        .filter(m => m.role !== 'system')
        .map(m => {
            const role = niceLabel(m.role);
            const text = ((m?.content?.[0]?.text || m?.content) || '').trim();
            return `${role}: ${text}`;
        })
        .join('\n');

    const aiRes = await chatCompletionByOpenAI(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: conversationText }
        ],
        req
    );

    let parsed = {};
    try {
        parsed = JSON.parse(aiRes.choices[0].message.content);
    } catch (e) {
        throw new Error('AI returned invalid JSON');
    }

    if (includeExtraQuestionExtraction && !Object.prototype.hasOwnProperty.call(parsed, 'extraQuestionAnswer')) {
        parsed.extraQuestionAnswer = null;
    }

    // Build $set for CandidateATS update
    const $set = {};

    if (parsed.experience) {
        if (typeof parsed.experience === 'object' && !Array.isArray(parsed.experience)) {
            $set.experience = parsed.experience;
        } else if (typeof parsed.experience === 'string') {
            const num = parsed.experience.match(/\d+/)?.[0] || parsed.experience;
            $set.experience = { total: num };
        }
    }

    if (parsed.currentCTC != null && parsed.currentCTC !== '')
        $set.currentCtc =
            typeof parsed.currentCTC === 'string'
                ? parsed.currentCTC
                : JSON.stringify(parsed.currentCTC);

    if (parsed.expectedCTC != null && parsed.expectedCTC !== '')
        $set.expectedCtc =
            typeof parsed.expectedCTC === 'string'
                ? parsed.expectedCTC
                : JSON.stringify(parsed.expectedCTC);

    if (parsed.noticePeriod != null && parsed.noticePeriod !== '')
        $set.noticePeriod =
            typeof parsed.noticePeriod === 'string'
                ? parsed.noticePeriod
                : JSON.stringify(parsed.noticePeriod);

    if (parsed.company != null && parsed.company !== '')
        $set.currentCompany =
            typeof parsed.company === 'string'
                ? parsed.company
                : JSON.stringify(parsed.company);

    if (parsed.location != null && parsed.location !== '')
        $set.location =
            typeof parsed.location === 'string' ? parsed.location : JSON.stringify(parsed.location);

    if (parsed.jobOffers != null)
        $set.anyOffer =
            typeof parsed.jobOffers === 'string'
                ? parsed.jobOffers.toLowerCase().startsWith('y')
                : Boolean(parsed.jobOffers);

    if (parsed.communicationRating != null && parsed.communicationRating !== '')
        $set.communication =
            typeof parsed.communicationRating === 'string'
                ? parsed.communicationRating
                : JSON.stringify(parsed.communicationRating);

    if (!includeExtraQuestionExtraction) {
        $set.extraQuestionAnswer = 'N/A';
    } else if (parsed.hasOwnProperty('extraQuestionAnswer')) {
        const val = parsed.extraQuestionAnswer;
        if (val === null) {
            $set.extraQuestionAnswer = null;
        } else if (val === undefined) {
            // do nothing
        } else if (typeof val === 'string') {
            $set.extraQuestionAnswer = val;
        } else {
            $set.extraQuestionAnswer = JSON.stringify(val);
        }
    }

    // Keep interested even if it's false or "Follow Up" or empty string, but only set when defined
    if (parsed.hasOwnProperty('interested')) {
        const val =
            typeof parsed.interested === 'string' ? parsed.interested : JSON.stringify(parsed.interested);
        $set.interested = val;
    }

    if (parsed?.PanCardNumber) {
        $set.PanCardNumber =
            typeof parsed.PanCardNumber === 'string'
                ? parsed.PanCardNumber
                : JSON.stringify(parsed.PanCardNumber);
    }

    // Transcript & audio URL
    $set.callAudioUrl = conv.audio_url;
    $set.transcript = Array.isArray(conv?.messages)
        ? conv.messages
            .filter(m => m.role !== 'system')
            .map(m => {
                const role = niceLabel(m.role);
                const text = ((m?.content?.[0]?.text || m?.content) || '').trim();
                const ts = m.time
                    ? new Date(m.time).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    })
                    : '';
                return ts ? `[${ts}] ${role}: ${text}` : `${role}: ${text}`;
            })
            .join('\n\n')
        : '';

    if (conv.audio_url) {
        try {
            $set.callAudioDuration = await getWavDuration(conv.audio_url);
        } catch (err) {
            console.warn(
                `[updateCandidateFromConversation] Failed to read audio duration convId=${conv?._id} audio_url=${conv.audio_url}: ${err?.message || err}`
            );
        }
    }

    // Clean undefined
    Object.keys($set).forEach(k => $set[k] === undefined && delete $set[k]);

    // Update CandidateATS for this candidate+job
    const updated = await req.conn.models['CandidateATS']
        .findOneAndUpdate(
            { candidate: conv.candidateId, job: conv.jobId, isArchived: false },
            { $set },
            { new: true, runValidators: true }
        )
        .lean();

    console.log(
        `[updateCandidateFromConversation] CandidateATS updated id=${updated?._id} callAudioUrl=${updated?.callAudioUrl || $set.callAudioUrl || 'n/a'} callAudioDuration=${updated?.callAudioDuration || $set.callAudioDuration || 'n/a'}`
    );

    // If we captured PAN, also mirror it on Candidate
    if ($set?.PanCardNumber) {
        try {
            await req.conn.models['Candidate'].findOneAndUpdate(
                { _id: conv.candidateId, isArchived: false },
                { panCardNumber: $set.PanCardNumber },
                { new: true, runValidators: true }
            );
        } catch {
            // non-fatal
        }
    }

    // Idempotent JD email: only on interested true/yes/follow up, only once

    if (!(callUUID || "")?.includes("wa_conv_____")) {
        try {
            const rawInterested = String(
                ($set?.interested ?? updated?.interested ?? '')
            )
                .trim()
                .toLowerCase();

            const shouldSendJD =
                rawInterested === 'true' ||
                rawInterested === 'yes' ||
                rawInterested === 'follow up' ||
                rawInterested === 'followup';

            const alreadySent = Boolean(updated?.jdMailSentAt);

            if (shouldSendJD && callUUID !== "call_simulation" && !alreadySent) {
                // Fetch candidate, job, company, uploader (if available)
                const [candDoc, jobDoc] = await Promise.all([
                    req.conn.models['Candidate']
                        .findOne({ _id: conv.candidateId, isArchived: false })
                        .select('firstName lastName email eventIds')
                        .populate({
                            path: 'eventIds',
                            select: 'eventName',
                            populate: {
                                path: 'eventName',
                                model: 'EventName',
                                select: 'name userId',
                                match: { name: 'Created' },
                                populate: {
                                    path: 'userId',
                                    model: 'User',
                                    select: 'firstName lastName email role'
                                }
                            }
                        })
                        .lean(),
                    req.conn.models['Job']
                        .findOne({ _id: conv.jobId, isArchived: false })
                        .select('title shortDescription description company')
                        .lean()
                ]);

                let companyDoc = null;
                if (jobDoc?.company) {
                    try {
                        companyDoc = await req.conn.models['Company']
                            .findOne({ _id: jobDoc.company, isArchived: false })
                            .select('name')
                            .lean();
                    } catch { }
                }

                const notificationPrefs = await getNotificationPreferences(req);
                const isTeamRole = (role) =>
                    ['client_admin', 'recruiter'].includes(String(role || '').toLowerCase());
                const allowInAppFor = (role) =>
                    !isTeamRole(role) || isInAppNotificationEnabled(notificationPrefs);

                // helper: create notification to recruiter/uploader
                const notifyMissingOrFailed = async ({ reason }) => {
                    const Notification = req.conn.models['Notification'];
                    const recruiterUserId = (req?.user?._id || req?.user?.sub || null);
                    const recruiterRole = req?.user?.role || '';
                    const createdEvent = (candDoc?.eventIds || []).find(e => e?.eventName?.name === 'Created');
                    const uploaderUserId = createdEvent?.eventName?.userId?._id || createdEvent?.eventName?.userId || null;
                    const uploaderRole = createdEvent?.eventName?.userId?.role || '';

                    const basePayload = {
                        client: req.client,
                        content: reason,
                        source: 'JD Mailer',
                        category: 'email',
                        href: `/candidates/${conv.candidateId}`,
                    };

                    // always notify the active recruiter
                    const toInsert = [];
                    if (recruiterUserId && allowInAppFor(recruiterRole)) {
                        toInsert.push({ ...basePayload, user: recruiterUserId });
                    }

                    // if uploader exists and differs, notify them too
                    if (
                        uploaderUserId &&
                        String(uploaderUserId) !== String(recruiterUserId) &&
                        allowInAppFor(uploaderRole)
                    ) {
                        toInsert.push({ ...basePayload, user: uploaderUserId });
                    }

                    try {
                        if (toInsert.length) {
                            await Notification.insertMany(toInsert, { ordered: false });
                        }
                    } catch (e) {
                        // swallow; notifications are best-effort
                        console.warn('Notification insert failed', e?.message || e);
                    }
                };

                const companyName = companyDoc?.name || 'our client';
                const fullJD =
                    (jobDoc?.description && String(jobDoc.description).trim()) ||
                    (jobDoc?.shortDescription && String(jobDoc.shortDescription).trim()) ||
                    'Job details will be shared in the next interaction.';

                const fullName =
                    [candDoc?.firstName, candDoc?.lastName].filter(Boolean).join(' ') || 'there';

                // If no email → notify and skip sending
                if (!candDoc?.email) {
                    await notifyMissingOrFailed({
                        reason: `JD email not sent for candidate without email. Candidate: ${fullName} • Job: ${jobDoc?.title || '—'}`,
                    });
                } else {
                    try {
                        // Actually send the JD email
                        await sendEmail({
                            to: candDoc.email,
                            subject: `Job Description: ${jobDoc?.title || ''} at ${companyName}`,
                            html: `
<p>Hi ${fullName},</p>
<p>Thanks for speaking with us. As discussed, here’s the job description for <strong>${jobDoc?.title || ''}</strong> at <strong>${companyName}</strong>:</p>
<p>${fullJD.replace(/\n/g, '<br/>')}</p>
<p>If this looks good, reply to confirm and we’ll move you forward.</p>
<p>Best regards,<br/>The Hirex REC Team</p>
                        `.trim(),
                            text: `
Hi ${fullName},

Thanks for speaking with us. As discussed, here’s the job description for ${jobDoc?.title || ''} at ${companyName}:

${fullJD}

If this looks good, reply to confirm and we’ll move you forward.

Best regards,
The Hirex REC Team
                        `.trim(),
                            reqContext: req,
                        });

                        // mark sent
                        await req.conn.models['CandidateATS'].findByIdAndUpdate(
                            updated._id,
                            { $set: { jdMailSentAt: new Date() } },
                            { new: true }
                        );
                    } catch (mailErr) {
                        // If the failure was because email invalid/missing or any provider error, notify
                        const reasonKey = mailErr?.name === 'EmailNotFound'
                            ? 'missing/invalid email address'
                            : 'email delivery failed';
                        await notifyMissingOrFailed({
                            reason: `JD email ${reasonKey}. Candidate: ${fullName} • Email: ${candDoc?.email || '—'} • Job: ${jobDoc?.title || '—'}`,
                        });
                    }
                }
            }
        } catch (mailBlockErr) {
            console.log('JD email step failed (non-fatal):', mailBlockErr?.message || mailBlockErr);
        }
    }

    // Dedupe eventIds if present
    if (updated && updated.eventIds && Array.isArray(updated.eventIds)) {
        const deduped = [...new Set(updated.eventIds.map(id => id.toString()))];
        if (deduped.length !== updated.eventIds.length) {
            await req.conn.models['CandidateATS'].findByIdAndUpdate(updated._id, {
                eventIds: deduped
            });
            updated.eventIds = deduped;
        }
    }

    return { summary: parsed, candidate: updated };
}




// // For testing purpose

// console.log(
//     "Testing began..."
// );


// // const dbName = "ApplyCup"; // prod
// // const client = "687fbd6c09e0ea9f448b3303"; // prod

// const dbName = "Applycup"; // dev
// const client = "68833f8c143e974c02e3cf23"; // dev

// const Cand_Job_cache = {};

// getClientDbConn(dbName)
//     .then(async clientConn => {

//         try {

//             const prntFilter = {
//             };

//             // const startOfToday = new Date();
//             // startOfToday.setHours(0, 0, 0, 0);  // 00:00:00.000

//             // const endOfToday = new Date();
//             // endOfToday.setHours(23, 59, 59, 999);  // 23:59:59.999


//             // prntFilter.createdAt = {
//             //     $gte: startOfToday,
//             //     $lte: endOfToday
//             // }

//             const uniqueCombos = await clientConn.models['Conversation'].aggregate([
//                 { $match: { ...prntFilter, isArchived: false } },
//                 {
//                     $group: {
//                         _id: { candidateId: "$candidateId", jobId: "$jobId" },
//                     }
//                 }
//             ]);

//             for (const candJobCombo of uniqueCombos) {

//                 const extraFilter = {
//                 };

//                 if (candJobCombo?._id?.jobId) extraFilter.jobId = candJobCombo?._id?.jobId;
//                 if (candJobCombo?._id?.candidateId) extraFilter.candidateId = candJobCombo?._id?.candidateId;

//                 const activeCount = await clientConn.models['Conversation'].countDocuments({ ...extraFilter, isArchived: false }).exec();

//                 console.log(
//                     "[" + extraFilter.candidateId + ", " + extraFilter.jobId + "] activeCount: ", activeCount,
//                 );

//                 const AllConv = await clientConn.models['Conversation'].find({ ...extraFilter, isArchived: false }).select("_id messages").skip(activeCount - 1).lean().exec();

//                 const conv = AllConv[0];

//                 if (candidateConvMsgs?.length > 5) {
//                     console.log("Updating from conv: ", conv._id);
//                     try {
//                         await updateCandidateFromConversation(conv._id, {
//                             conn: clientConn,
//                             client,
//                         });
//                     } catch (err) {
//                         console.log(
//                             "❌ Error in updating function call: ", err
//                         );
//                         continue;

//                     }
//                 } else {
//                     console.log(
//                         "conv._id: ", conv._id, "Message length: ", candidateConvMsgs?.length,
//                     );

//                 }

//             }

//         } catch (err) {
//             console.log(
//                 "❌ Error in Updating Data: ", err
//             );

//         }
//     })
//     .catch((err) => {
//         console.log(
//             "❌ Error in getting data from conversation to Candidate ATS: ", err
//         );

//     })
//     .finally(() => {
//         console.log(
//             "\n Updating data from conversation to Candidate ATS is finished...\n\n"
//         );

//     });


export default updateCandidateFromConversation;
