import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_TIMEZONE, normalizeTimeZone } from '../../utils/timeUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: pdfkit does not natively render SVG via doc.image in many setups.
// Keeping try/catch so it doesn't crash your PDF generation.
const LOGO_PATH = path.resolve(__dirname, '../../utils/aiselekt_icon_light_transparent.svg');

function tryDrawLogo(doc) {
    try {
        const width = 90;
        const x = doc.page.width - doc.page.margins.right - width;
        const y = 24;
        doc.image(LOGO_PATH, x, y, { width });
    } catch (_err) {
        // Optional logo
    }
}

function drawHeader(doc, title, companyName) {
    const left = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.save().rect(left, 25, usableWidth, 42).fill('#e5f2ff').restore();

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text(title, left + 16, 32);

    if (companyName) {
        doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#64748b')
            .text(companyName, left + 16, 52);
    }

    tryDrawLogo(doc);
    doc.moveDown(3);
}

function clampScore(v) {
    return typeof v === 'number' && !Number.isNaN(v) ? Math.max(0, Math.min(100, v)) : null;
}

function scoreColors(score) {
    if (score === null) return { bg: '#e5e7eb', fg: '#111827', border: '#cbd5e1' };
    if (score >= 70) return { bg: '#dcfce7', fg: '#14532d', border: '#86efac' };
    if (score >= 40) return { bg: '#fef9c3', fg: '#713f12', border: '#fde68a' };
    return { bg: '#fee2e2', fg: '#7f1d1d', border: '#fecaca' };
}

function ensureSpace(doc, minSpace, { companyName, continuedTitle } = {}) {
    const bottomY = doc.page.height - doc.page.margins.bottom;
    if (doc.y + minSpace <= bottomY) return;

    doc.addPage();
    if (continuedTitle) drawHeader(doc, continuedTitle, companyName);
}

function drawCard(doc, x, y, w, h, { fill = '#ffffff', border = '#e2e8f0', radius = 10 } = {}) {
    doc.save();
    if (typeof doc.roundedRect === 'function') doc.roundedRect(x, y, w, h, radius).fillAndStroke(fill, border);
    else doc.rect(x, y, w, h).fillAndStroke(fill, border);
    doc.restore();
}

function wrapCodeLines(doc, code, maxWidth) {
    const safe = String(code || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n');

    const out = [];
    for (const rawLine of safe) {
        const line = rawLine.replace(/\t/g, '    ');
        if (!line) {
            out.push('');
            continue;
        }

        let remaining = line;
        while (remaining.length) {
            let low = 1;
            let high = remaining.length;
            let best = 1;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const segment = remaining.slice(0, mid);
                if (doc.widthOfString(segment) <= maxWidth) {
                    best = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            out.push(remaining.slice(0, best));
            remaining = remaining.slice(best);
        }
    }

    return out;
}

function firstNonEmptyUrl(...vals) {
    for (const v of vals) {
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
}

function normalizeInterviewerType(value) {
    return String(value || '').trim().toLowerCase();
}

function isHumanAiInterviewerType(value) {
    const normalized = normalizeInterviewerType(value);
    return normalized === 'human+ai' || normalized === 'human + ai' || normalized === 'human & ai';
}

function isHumanOnlyInterviewerType(value) {
    return normalizeInterviewerType(value) === 'human';
}

function isHumanInterviewerType(value) {
    return isHumanOnlyInterviewerType(value) || isHumanAiInterviewerType(value);
}

function isCodingInterviewSchedule(schedule) {
    const roundType = String(schedule?.roundType || '').trim().toLowerCase();
    const interviewType = String(schedule?.interviewType || '').trim().toLowerCase();
    return roundType.includes('coding') || interviewType.includes('coding');
}

function formatCodingValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function truncateCodingValue(value, maxLen = 120) {
    const text = formatCodingValue(value);
    if (!text) return '(empty)';
    return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function resolveSubmittedOutput(result, finalSubmission) {
    return (
        result?.output ??
        result?.stdout ??
        result?.candidateOutput ??
        result?.actualOutput ??
        result?.resultOutput ??
        result?.userOutput ??
        result?.message ??
        result?.error ??
        result?.stderr ??
        result?.result?.output ??
        result?.result?.stdout ??
        result?.result?.message ??
        result?.result?.error ??
        result?.result?.stderr ??
        result?.submissionOutput ??
        result?.outputValue ??
        finalSubmission?.stdout ??
        finalSubmission?.output ??
        finalSubmission?.message ??
        finalSubmission?.compilerOutput ??
        finalSubmission?.stderr ??
        ''
    );
}

function getCodingResultMeta(result) {
    const statusObj = result?.status;
    const statusLabel = typeof statusObj === 'string'
        ? statusObj
        : (statusObj?.label || statusObj?.description || result?.result || result?.outcome || '');
    const raw = String(statusLabel || '').trim().toLowerCase();

    const isPass =
        result?.passed === true ||
        result?.isCorrect === true ||
        statusObj?.id === 3 ||
        raw.includes('pass') ||
        raw.includes('accept') ||
        raw.includes('correct');

    if (isPass) {
        return {
            label: 'Pass',
            badgeBg: '#dcfce7',
            badgeBorder: '#86efac',
            badgeFg: '#14532d',
        };
    }

    if (raw.includes('time limit')) {
        return {
            label: 'Time Limit',
            badgeBg: '#fee2e2',
            badgeBorder: '#fecaca',
            badgeFg: '#7f1d1d',
        };
    }

    if (raw.includes('runtime')) {
        return {
            label: 'Runtime Error',
            badgeBg: '#fee2e2',
            badgeBorder: '#fecaca',
            badgeFg: '#7f1d1d',
        };
    }

    const isFail =
        result?.passed === false ||
        result?.isCorrect === false ||
        statusObj?.id === 4 ||
        raw.includes('fail') ||
        raw.includes('wrong') ||
        raw.includes('error');

    if (isFail) {
        return {
            label: 'Fail',
            badgeBg: '#fee2e2',
            badgeBorder: '#fecaca',
            badgeFg: '#7f1d1d',
        };
    }

    return {
        label: statusLabel ? String(statusLabel).replace(/_/g, ' ').trim() : 'Unknown',
        badgeBg: '#e5e7eb',
        badgeBorder: '#cbd5e1',
        badgeFg: '#374151',
    };
}

export function generateInterviewReportPdf({ schedule, candidate, job, conversation, finalSubmission }) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    const candidateName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate';
    const jobTitle = job?.title || job?.internalTitle || 'Role';
    const companyName = job?.company?.name || 'Company';

    const interviewDate = schedule?.startAt ? new Date(schedule.startAt) : null;
    const interviewEndedAt = schedule?.endedAt ? new Date(schedule.endedAt) : null;
    const scheduledDurationMinutes = typeof schedule?.durationMinutes === 'number' ? schedule.durationMinutes : null;
    const actualDurationMinutes = interviewDate && interviewEndedAt
        ? Math.max(1, Math.round((interviewEndedAt - interviewDate) / 60000))
        : null;
    const scheduleTimezone = normalizeTimeZone(schedule?.timezone, DEFAULT_TIMEZONE);
    const isHumanAI = isHumanAiInterviewerType(schedule?.interviewerType);
    const isHumanOnly = isHumanOnlyInterviewerType(schedule?.interviewerType);
    const isHumanInterviewer = isHumanInterviewerType(schedule?.interviewerType);
    const isCodingInterview = isCodingInterviewSchedule(schedule);
    const dateStr = interviewDate
        ? interviewDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: scheduleTimezone
        })
        : 'N/A';

    const breakdown = schedule?.evaluationBreakdown || schedule?.evaluation?.breakdown || {};

    const rawTotalScore =
        schedule?.evaluationScore ??
        schedule?.evaluation?.totalScore ??
        schedule?.evaluation?.score ??
        schedule?.evaluation?.overallScore ??
        breakdown?.totalScore ??
        breakdown?.evaluationScore ??
        breakdown?.score ??
        null;

    const techScore = clampScore(rawTotalScore);

    const overallReason =
        (typeof schedule?.overallReason === 'string' && schedule.overallReason.trim()) ||
        (typeof schedule?.evaluation?.overallReason === 'string' && schedule.evaluation.overallReason.trim()) ||
        (typeof schedule?.evaluation?.reason === 'string' && schedule.evaluation.reason.trim()) ||
        (typeof schedule?.evaluationReason === 'string' && schedule.evaluationReason.trim()) ||
        (typeof breakdown?.overallReason === 'string' && breakdown.overallReason.trim()) ||
        (typeof breakdown?.evaluationReason === 'string' && breakdown.evaluationReason.trim()) ||
        (typeof breakdown?.reason === 'string' && breakdown.reason.trim()) ||
        null;

    const parametersRaw =
        schedule?.evaluation?.parameters ||
        breakdown?.parameters ||
        breakdown?.parameterWiseEvaluation ||
        breakdown?.parameterWiseScores ||
        breakdown?.parameterWise ||
        schedule?.parameterWiseEvaluation ||
        schedule?.evaluation?.parameterWise ||
        schedule?.evaluation?.parameterWiseScores ||
        null;

    const parameterWiseScores = (() => {
        const normalizeItem = (name, item) => {
            const cleanName = typeof name === 'string' ? name.trim() : '';
            if (!cleanName) return null;

            if (typeof item === 'number') {
                return { name: cleanName, score: clampScore(item), reason: null, group: null, weight: 1 };
            }

            const scoreVal = item?.score ?? item?.value ?? item?.percentage ?? item?.obtainedScore ?? item?.totalScore ?? null;
            const weightVal =
                item?.weight ??
                item?.weightage ??
                item?.parameter?.weight ??
                item?.parameter?.weightage ??
                null;

            const reasonVal =
                (typeof item?.reason === 'string' && item.reason.trim()) ||
                (typeof item?.feedback === 'string' && item.feedback.trim()) ||
                (typeof item?.comment === 'string' && item.comment.trim()) ||
                (typeof item?.summary === 'string' && item.summary.trim()) ||
                null;

            const groupVal =
                (typeof item?.group === 'string' && item.group.trim()) ||
                (typeof item?.category === 'string' && item.category.trim()) ||
                null;

            const weight =
                typeof weightVal === 'number' && Number.isFinite(weightVal) && weightVal > 0
                    ? weightVal
                    : 1;

            return { name: cleanName, score: clampScore(scoreVal), reason: reasonVal, group: groupVal, weight };
        };

        if (!parametersRaw) return [];

        if (Array.isArray(parametersRaw)) {
            return parametersRaw
                .map((item) => {
                    const name =
                        (typeof item?.parameterName === 'string' && item.parameterName.trim()) ||
                        (typeof item?.name === 'string' && item.name.trim()) ||
                        (typeof item?.title === 'string' && item.title.trim()) ||
                        (typeof item?.parameter?.name === 'string' && item.parameter.name.trim()) ||
                        '';
                    return normalizeItem(name, item);
                })
                .filter(Boolean);
        }

        if (typeof parametersRaw === 'object') {
            if (Array.isArray(parametersRaw.parameters)) {
                return parametersRaw.parameters
                    .map((item) => {
                        const name =
                            (typeof item?.parameterName === 'string' && item.parameterName.trim()) ||
                            (typeof item?.name === 'string' && item.name.trim()) ||
                            (typeof item?.title === 'string' && item.title.trim()) ||
                            (typeof item?.parameter?.name === 'string' && item.parameter.name.trim()) ||
                            '';
                        return normalizeItem(name, item);
                    })
                    .filter(Boolean);
            }

            if (Array.isArray(parametersRaw.scores)) {
                return parametersRaw.scores
                    .map((item) => {
                        const name =
                            (typeof item?.parameterName === 'string' && item.parameterName.trim()) ||
                            (typeof item?.name === 'string' && item.name.trim()) ||
                            (typeof item?.title === 'string' && item.title.trim()) ||
                            (typeof item?.parameter?.name === 'string' && item.parameter.name.trim()) ||
                            '';
                        return normalizeItem(name, item);
                    })
                    .filter(Boolean);
            }

            return Object.entries(parametersRaw).map(([k, v]) => normalizeItem(k, v)).filter(Boolean);
        }

        return [];
    })();

    const COMMUNICATION_PARAMETER_NAME = 'Communication & Clarity';

    const commParam =
        (schedule?.evaluation?.parameters &&
            (schedule.evaluation.parameters['Communication & Clarity'] ||
                schedule.evaluation.parameters['Communication and Clarity'])) ||
        null;

    const commFromBreakdown = breakdown?.communication || null;
    const commScore = clampScore(commParam?.score ?? commFromBreakdown?.score ?? null);

    const commReason =
        (typeof commParam?.reason === 'string' && commParam.reason.trim()) ||
        (typeof commFromBreakdown?.reason === 'string' && commFromBreakdown.reason.trim()) ||
        null;

    const parameterEvidenceStats =
        schedule?.evaluationBreakdown?.parameterEvidenceStats ||
        schedule?.evaluation?.breakdown?.parameterEvidenceStats ||
        schedule?.evaluationBreakdown?.breakdown?.parameterEvidenceStats ||
        schedule?.evaluation?.parameterEvidenceStats ||
        schedule?.parameterEvidenceStats ||
        null;

    const normalizeParamKey = (value) => String(value || '').trim().toLowerCase();
    const evidenceOkByParam = new Map(
        parameterEvidenceStats && typeof parameterEvidenceStats === 'object'
            ? Object.entries(parameterEvidenceStats).map(([key, val]) => [
                normalizeParamKey(key),
                !!val?.ok,
            ])
            : []
    );

    const isParamCovered = (param) => {
        const key = normalizeParamKey(param?.name);
        if (!key) return false;
        const evidenceFlag = evidenceOkByParam.get(key);
        if (typeof evidenceFlag === 'boolean') return evidenceFlag;

        if (key === normalizeParamKey(COMMUNICATION_PARAMETER_NAME)) {
            return typeof param?.score === 'number' && Number.isFinite(param.score);
        }

        if (typeof param?.score !== 'number' || Number.isNaN(param.score)) return false;
        const reason = String(param?.reason || '').toLowerCase();
        if (reason.includes('insufficient evidence') || reason.includes('no substantial answer')) {
            return false;
        }
        return true;
    };

    const getParamWeight = (param) =>
        typeof param?.weight === 'number' && Number.isFinite(param.weight) && param.weight > 0
            ? param.weight
            : 1;

    const totalParamCount = parameterWiseScores.length;
    const scoredParams = parameterWiseScores.filter((param) => typeof param.score === 'number' && !Number.isNaN(param.score));
    const allWeightSum = scoredParams.reduce((acc, param) => acc + getParamWeight(param), 0);
    const allWeightedSum = scoredParams.reduce((acc, param) => acc + param.score * getParamWeight(param), 0);
    const totalScoreAllParams = allWeightSum > 0 ? Math.round(allWeightedSum / allWeightSum) : null;

    const completedParams = scoredParams.filter(isParamCovered);
    const completedParamCount = completedParams.length;
    const completedWeightSum = completedParams.reduce((acc, param) => acc + getParamWeight(param), 0);
    const completedWeightedSum = completedParams.reduce((acc, param) => acc + param.score * getParamWeight(param), 0);
    const totalScoreCompletedParams =
        completedWeightSum > 0 ? Math.round(completedWeightedSum / completedWeightSum) : null;

    const showCoverageBreakdown =
        totalParamCount > 0 &&
        totalScoreAllParams !== null &&
        totalScoreCompletedParams !== null;
    const summaryScore = totalScoreCompletedParams ?? techScore;
    const summaryScoreTitle = isHumanAI ? 'Holistic Interview Score' : 'Covered Parameters Score';
    const summaryScoreSubtitle = isHumanAI
        ? 'AI-assessed holistic score across core interview dimensions'
        : totalParamCount > 0
            ? `Asked & answered only (${completedParamCount}/${totalParamCount} covered)`
            : 'Coverage details will appear once scoring is completed.';

    // ✅ FIX: no convoUrl. Only resolve from actual fields.
    const fallbackRecordingUrl = firstNonEmptyUrl(
        breakdown?.videoRecordingUrl,
        breakdown?.recordingUrl,
        breakdown?.videoUrl
    );

    const videoRecordingUrl = firstNonEmptyUrl(
        schedule?.videoRecordingUrl,
        schedule?.evaluationBreakdown?.videoRecordingUrl,
        fallbackRecordingUrl
    );

    const sessionLink = firstNonEmptyUrl(schedule?.meetingLink, schedule?.webrtcLink);

    const difficultyLabel =
        isCodingInterview
            ? (schedule?.codingConfig?.questionLevel || schedule?.difficultyLevel || 'Medium')
            : (schedule?.difficultyLevel || 'Intermediate');

    const remoteProctoring = schedule?.remoteProctoring || null;
    const rpReasonCounts = remoteProctoring?.reasonCounts || {};
    const rpViolationCount = typeof remoteProctoring?.violationCount === 'number' ? remoteProctoring.violationCount : null;

    const tabsEvents = (rpReasonCounts.TAB_HIDDEN || 0) + (rpReasonCounts.WINDOW_BLUR || 0);
    const cameraEvents = (rpReasonCounts.CAMERA_TOGGLE_BLOCKED || 0) + (rpReasonCounts.CAMERA_TRACK_ENDED || 0);
    const multiFacesEvents = rpReasonCounts.MULTIPLE_FACES_DETECTED || 0;
    const multiVoicesEvents = rpReasonCounts.MULTIPLE_VOICES_DETECTED || 0;

    const yesNo = (flag) => (flag ? 'Yes' : 'No');

    const interviewerFeedback =
        schedule?.interviewerFeedback && typeof schedule.interviewerFeedback === 'object'
            ? schedule.interviewerFeedback
            : null;

    const feedbackRating =
        typeof interviewerFeedback?.rating === 'number' && Number.isFinite(interviewerFeedback.rating)
            ? Math.max(0, Math.min(5, Math.round(interviewerFeedback.rating)))
            : null;

    const feedbackRecommendation =
        typeof interviewerFeedback?.recommendation === 'string' && interviewerFeedback.recommendation.trim()
            ? interviewerFeedback.recommendation.trim()
            : null;

    const feedbackStrengths =
        typeof interviewerFeedback?.strengths === 'string' && interviewerFeedback.strengths.trim()
            ? interviewerFeedback.strengths.trim()
            : null;

    const feedbackImprovements =
        typeof interviewerFeedback?.improvements === 'string' && interviewerFeedback.improvements.trim()
            ? interviewerFeedback.improvements.trim()
            : null;

    const feedbackOverallComment =
        typeof interviewerFeedback?.overallComment === 'string' && interviewerFeedback.overallComment.trim()
            ? interviewerFeedback.overallComment.trim()
            : null;

    const feedbackParameterRatings = Array.isArray(interviewerFeedback?.parameterRatings)
        ? interviewerFeedback.parameterRatings
            .map((row) => {
                const skill =
                    typeof row?.skill === 'string' && row.skill.trim() ? row.skill.trim() : null;
                if (!skill) return null;
                const rating =
                    typeof row?.rating === 'number' && Number.isFinite(row.rating)
                        ? Math.max(0, Math.min(5, Math.round(row.rating)))
                        : null;
                const comment =
                    typeof row?.comment === 'string' && row.comment.trim() ? row.comment.trim() : null;
                return { skill, rating, comment };
            })
            .filter(Boolean)
        : [];

    const feedbackSubmittedAt = interviewerFeedback?.submittedAt
        ? new Date(interviewerFeedback.submittedAt)
        : null;
    const feedbackSubmittedAtText =
        feedbackSubmittedAt && !Number.isNaN(feedbackSubmittedAt.getTime())
            ? feedbackSubmittedAt.toLocaleString('en-IN', { timeZone: scheduleTimezone })
            : null;

    const hasInterviewerFeedback =
        (typeof feedbackRating === 'number' && feedbackRating > 0) ||
        !!feedbackRecommendation ||
        !!feedbackStrengths ||
        !!feedbackImprovements ||
        !!feedbackOverallComment ||
        feedbackParameterRatings.length > 0;

    // PAGE 1
    drawHeader(doc, 'Interview Report Summary', companyName);

    const pageLeft = doc.page.margins.left;
    const pageRight = doc.page.width - doc.page.margins.right;
    const usableWidth = pageRight - pageLeft;

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#111827').text(candidateName, pageLeft, doc.y);

    doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#4b5563')
        .text(`${jobTitle} @ ${companyName}`, pageLeft, doc.y + 2);

    doc.moveDown(0.8);

    doc.fontSize(10).fillColor('#374151');
    doc.text(`Interviewed On: ${dateStr}`, pageLeft);
    doc.text(`Interview Mode: ${schedule?.interviewMode || 'N/A'}`, pageLeft);
    doc.text(`Interview Type: ${schedule?.interviewType || 'Technical'}`, pageLeft);
    doc.text(`Interview Difficulty: ${difficultyLabel}`, pageLeft);
    doc.text(`Interviewer Type: ${schedule?.interviewerType || 'AI'}`, pageLeft);
    if (actualDurationMinutes !== null) {
        const durationNote = scheduledDurationMinutes && scheduledDurationMinutes !== actualDurationMinutes
            ? ` (Scheduled: ${scheduledDurationMinutes} min)`
            : '';
        doc.text(`Interview Duration: ${actualDurationMinutes} min${durationNote}`, pageLeft);
    } else if (scheduledDurationMinutes) {
        doc.text(`Interview Duration: ${scheduledDurationMinutes} min (scheduled)`, pageLeft);
    }

    doc.moveDown(1.2);

    // ✅ CONDITIONAL: Coding Round vs Speaking Round
    if (isCodingInterview && finalSubmission) {
        // ========== CODING ROUND REPORT ==========
        ensureSpace(doc, 170, { companyName, continuedTitle: 'Interview Report Summary' });

        // Submission Summary Box
        const summaryBoxTop = doc.y + 6;
        const summaryBoxLeft = pageLeft;
        const summaryBoxWidth = usableWidth;
        const summaryBoxHeight = 100;

        drawCard(doc, summaryBoxLeft, summaryBoxTop, summaryBoxWidth, summaryBoxHeight, {
            fill: '#eff6ff',
            border: '#bfdbfe',
            radius: 14,
        });

        const padding = 16;
        const innerLeft = summaryBoxLeft + padding;
        const innerTop = summaryBoxTop + padding;

        doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(12).text('Coding Submission Summary', innerLeft, innerTop);

        // Problem and Language
        doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold');
        doc.text(`Problem: ${finalSubmission.problemId?.title || 'N/A'}`, innerLeft, innerTop + 22);
        doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
        doc.text(`Difficulty: ${finalSubmission.problemId?.difficulty || 'N/A'} | Language: ${finalSubmission.language?.name || 'N/A'}`, innerLeft, innerTop + 38);

        const resultRows = Array.isArray(finalSubmission.results) ? finalSubmission.results : [];

        // Test Cases Passed
        const inferredTotal = resultRows.length;
        const inferredPassed = resultRows.reduce(
            (acc, row) => acc + (getCodingResultMeta(row).label === 'Pass' ? 1 : 0),
            0
        );
        const totalCountRaw = Number(finalSubmission.totalTestCases);
        const passedCountRaw = Number(finalSubmission.passedTestCases);
        const totalCount = Number.isFinite(totalCountRaw) && totalCountRaw > 0
            ? totalCountRaw
            : inferredTotal;
        const passedCount = Number.isFinite(passedCountRaw) && passedCountRaw >= 0
            ? Math.min(passedCountRaw, Math.max(totalCount, 0))
            : Math.min(inferredPassed, Math.max(totalCount, 0));
        const passPercent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
        doc.text(`Test Cases: ${passedCount}/${totalCount} Passed (${passPercent}%)`, innerLeft, innerTop + 54);

        // Execution Metrics
        const execTime = finalSubmission.executionTime ? `${(finalSubmission.executionTime * 1000).toFixed(0)} ms` : 'N/A';
        const memUsed = finalSubmission.memoryUsed ? `${(finalSubmission.memoryUsed / 1024).toFixed(2)} MB` : 'N/A';

        doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
        doc.text(`Execution Time: ${execTime} | Memory Used: ${memUsed}`, innerLeft, innerTop + 70);

        doc.y = summaryBoxTop + summaryBoxHeight + 12;

        const resultByTestCaseId = new Map();
        const resultByOrder = new Map();

        resultRows.forEach((row, idx) => {
            const testCaseIdRaw =
                row?.testCaseId?._id ??
                row?.testCaseId?.id ??
                row?.testCaseId ??
                row?.testCase?._id ??
                row?.testCase?.id ??
                row?.testCase ??
                row?._id ??
                row?.id ??
                null;
            if (testCaseIdRaw) resultByTestCaseId.set(String(testCaseIdRaw), row);

            const orderKey = String(row?.testCaseId?.order ?? row?.order ?? row?.index ?? (idx + 1));
            if (orderKey) resultByOrder.set(orderKey, row);
        });

        // ✅ Problem Statement Section
        if (finalSubmission.problemId?.description) {
            doc.addPage();
            drawHeader(doc, 'Problem Statement', companyName);

            doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827');
            doc.text(finalSubmission.problemId.title || 'Coding Problem', pageLeft);
            doc.moveDown(0.3);

            doc.font('Helvetica').fontSize(10).fillColor('#4b5563');
            doc.text(finalSubmission.problemId.description, pageLeft, doc.y, {
                width: usableWidth,
                align: 'left',
            });
            doc.moveDown(1);

            // Constraints
            if (finalSubmission.problemId.constraints) {
                doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Constraints:');
                doc.moveDown(0.3);
                doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
                doc.text(finalSubmission.problemId.constraints, pageLeft, doc.y, {
                    width: usableWidth,
                });
                doc.moveDown(1);
            }
        }

        // ✅ Source Code Section
        if (finalSubmission.sourceCode) {
            ensureSpace(doc, 150, { companyName, continuedTitle: 'Candidate Solution' });

            doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Submitted Code');
            doc.moveDown(0.5);

            const codePadding = 12;
            const codeFontSize = 8;
            const codeTextWidth = usableWidth - (codePadding * 2);

            doc.font('Courier').fontSize(codeFontSize).fillColor('#d4d4d4');
            const wrappedLines = wrapCodeLines(doc, finalSubmission.sourceCode, codeTextWidth);
            const lineHeight = doc.currentLineHeight(true);
            let lineIndex = 0;

            while (lineIndex < wrappedLines.length) {
                const codeBoxTop = doc.y;
                const availableHeight = (doc.page.height - doc.page.margins.bottom) - codeBoxTop;
                const maxBoxHeight = Math.max(140, Math.min(520, availableHeight));
                const maxLines = Math.max(
                    1,
                    Math.floor((maxBoxHeight - (codePadding * 2)) / lineHeight)
                );

                const linesForBox = wrappedLines.slice(lineIndex, lineIndex + maxLines);
                const boxHeight = Math.min(
                    maxBoxHeight,
                    (linesForBox.length * lineHeight) + (codePadding * 2)
                );

                drawCard(doc, pageLeft, codeBoxTop, usableWidth, boxHeight, {
                    fill: '#1e1e1e',
                    border: '#333333',
                    radius: 8,
                });

                doc.text(linesForBox.join('\n'), pageLeft + codePadding, codeBoxTop + codePadding, {
                    width: codeTextWidth,
                    lineBreak: false,
                });

                lineIndex += linesForBox.length;
                doc.y = codeBoxTop + boxHeight;

                if (lineIndex < wrappedLines.length) {
                    doc.addPage();
                    drawHeader(doc, 'Candidate Solution', companyName);
                    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Submitted Code (continued)');
                    doc.moveDown(0.5);
                    doc.font('Courier').fontSize(codeFontSize).fillColor('#d4d4d4');
                } else {
                    doc.moveDown(1);
                }
            }
        }

        // ✅ Test Case Details Section
        const allTestCases = Array.isArray(finalSubmission.allTestCases) ? finalSubmission.allTestCases : [];
        const evaluationRows = allTestCases.length > 0
            ? allTestCases.map((testCase, idx) => {
                const orderKey = String(testCase.order ?? (idx + 1));
                const testCaseIdRaw = testCase?._id ?? testCase?.id ?? null;
                const matchedResult =
                    (testCaseIdRaw ? resultByTestCaseId.get(String(testCaseIdRaw)) : null) ||
                    resultByOrder.get(orderKey) ||
                    null;
                const rawTime =
                    matchedResult?.executionTime ??
                    matchedResult?.time ??
                    matchedResult?.timeMs ??
                    matchedResult?.runtimeMs ??
                    null;
                const timeText =
                    typeof rawTime === 'number'
                        ? `${rawTime < 50 ? Math.round(rawTime * 1000) : Math.round(rawTime)} ms`
                        : '-';
                return {
                    order: testCase.order ?? (idx + 1),
                    isSample: !!testCase.isSample,
                    input: testCase.input ?? testCase.args ?? testCase.stdin ?? '',
                    expected: testCase.expectedOutput ?? testCase.expected ?? testCase.output ?? '',
                    submitted: resolveSubmittedOutput(matchedResult, finalSubmission),
                    statusMeta: getCodingResultMeta(matchedResult),
                    timeText,
                };
            })
            : resultRows.map((result, idx) => {
                const tc = result?.testCaseId || {};
                const rawTime =
                    result?.executionTime ??
                    result?.time ??
                    result?.timeMs ??
                    result?.runtimeMs ??
                    null;
                const timeText =
                    typeof rawTime === 'number'
                        ? `${rawTime < 50 ? Math.round(rawTime * 1000) : Math.round(rawTime)} ms`
                        : '-';
                return {
                    order: tc.order ?? result?.order ?? (idx + 1),
                    isSample: !!tc.isSample,
                    input: tc.input ?? tc.args ?? tc.stdin ?? result?.input ?? '',
                    expected: tc.expectedOutput ?? tc.expected ?? tc.output ?? result?.expectedOutput ?? '',
                    submitted: resolveSubmittedOutput(result, finalSubmission),
                    statusMeta: getCodingResultMeta(result),
                    timeText,
                };
            });

        if (evaluationRows.length > 0) {
            doc.addPage();
            drawHeader(doc, 'Test Case Evaluation', companyName);

            doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
            doc.text('Each test case shows input, expected output, submitted output and verdict.', {
                width: usableWidth,
            });
            doc.moveDown(1);

            evaluationRows.forEach((row) => {
                const tcPadding = 12;
                const labelWidth = 56;
                const valueWidth = usableWidth - (tcPadding * 2) - labelWidth;
                const inputText = truncateCodingValue(row.input, 220);
                const expectedText = truncateCodingValue(row.expected, 220);
                const submittedText = truncateCodingValue(row.submitted, 220);

                doc.font('Courier').fontSize(8);
                const inputH = Math.max(11, doc.heightOfString(inputText, { width: valueWidth }));
                const expectedH = Math.max(11, doc.heightOfString(expectedText, { width: valueWidth }));
                const submittedH = Math.max(11, doc.heightOfString(submittedText, { width: valueWidth }));

                const bodySpacing = 6;
                const headerHeight = 24;
                const footerHeight = 16;
                const bodyHeight =
                    inputH +
                    expectedH +
                    submittedH +
                    (bodySpacing * 2);
                const tcDetailHeight = Math.max(
                    108,
                    tcPadding + headerHeight + bodyHeight + footerHeight + tcPadding
                );

                ensureSpace(doc, tcDetailHeight + 14, {
                    companyName,
                    continuedTitle: 'Test Case Evaluation (continued)',
                });

                const tcDetailTop = doc.y;

                drawCard(doc, pageLeft, tcDetailTop, usableWidth, tcDetailHeight, {
                    fill: '#f9fafb',
                    border: '#e2e8f0',
                    radius: 10,
                });

                doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
                doc.text(
                    `Test Case #${row.order}${row.isSample ? ' (Sample)' : ''}`,
                    pageLeft + tcPadding,
                    tcDetailTop + tcPadding,
                    { width: usableWidth - (tcPadding * 2) - 84 }
                );

                const badgeW = 74;
                const badgeX = pageLeft + usableWidth - tcPadding - badgeW;
                const badgeY = tcDetailTop + tcPadding - 2;
                doc.save();
                if (typeof doc.roundedRect === 'function') {
                    doc.roundedRect(badgeX, badgeY, badgeW, 18, 9).fillAndStroke(row.statusMeta.badgeBg, row.statusMeta.badgeBorder);
                } else {
                    doc.rect(badgeX, badgeY, badgeW, 18).fillAndStroke(row.statusMeta.badgeBg, row.statusMeta.badgeBorder);
                }
                doc.restore();
                doc.font('Helvetica-Bold').fontSize(8).fillColor(row.statusMeta.badgeFg);
                doc.text(row.statusMeta.label, badgeX, badgeY + 5, { width: badgeW, align: 'center' });

                let cursorY = tcDetailTop + tcPadding + headerHeight;

                const drawField = (label, value) => {
                    doc.font('Helvetica').fontSize(8).fillColor('#4b5563');
                    doc.text(`${label}:`, pageLeft + tcPadding, cursorY, { width: labelWidth - 4 });

                    doc.font('Courier').fontSize(8).fillColor('#111827');
                    doc.text(value, pageLeft + tcPadding + labelWidth, cursorY, { width: valueWidth });

                    const textH = Math.max(11, doc.heightOfString(value, { width: valueWidth }));
                    cursorY += textH + bodySpacing;
                };

                drawField('Input', inputText);
                drawField('Expected', expectedText);
                drawField('Submitted', submittedText);

                doc.font('Helvetica').fontSize(8).fillColor('#4b5563');
                doc.text(
                    `Result: ${row.statusMeta.label} | Time: ${row.timeText}`,
                    pageLeft + tcPadding,
                    tcDetailTop + tcDetailHeight - tcPadding - 10
                );

                doc.y = tcDetailTop + tcDetailHeight + 10;
            });
        }

    } else if (!isCodingInterview && !isHumanOnly && summaryScore !== null) {
        // ========== SPEAKING ROUND REPORT (ORIGINAL) ==========
        ensureSpace(doc, 170, { companyName, continuedTitle: 'Interview Report Summary' });

        const scoreBoxTop = doc.y + 6;
        const scoreBoxLeft = pageLeft;
        const scoreBoxWidth = usableWidth;
        const scoreBoxHeight = 86;

        drawCard(doc, scoreBoxLeft, scoreBoxTop, scoreBoxWidth, scoreBoxHeight, {
            fill: '#eff6ff',
            border: '#bfdbfe',
            radius: 14,
        });

        const padding = 16;
        const innerLeft = scoreBoxLeft + padding;
        const innerTop = scoreBoxTop + padding;

        doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(12).text(summaryScoreTitle, innerLeft, innerTop);

        doc.fontSize(22).fillColor('#0f172a').text(`${summaryScore}/100`, innerLeft, innerTop + 18);

        const barWidth = scoreBoxWidth - padding * 2;
        const barHeight = 10;
        const barX = innerLeft;
        const barY = scoreBoxTop + scoreBoxHeight - padding - barHeight;

        doc.save().rect(barX, barY, barWidth, barHeight).fillColor('#bfdbfe').fill().restore();

        const filledWidth = Math.max(0, Math.min(barWidth, (summaryScore / 100) * barWidth));
        doc.save().rect(barX, barY, filledWidth, barHeight).fillColor('#2563eb').fill().restore();

        doc.y = scoreBoxTop + scoreBoxHeight + 12;

        if (showCoverageBreakdown) {
            ensureSpace(doc, 86, { companyName, continuedTitle: 'Interview Report Summary' });

            const coverageTop = doc.y;
            const coverageHeight = 64;

            drawCard(doc, scoreBoxLeft, coverageTop, scoreBoxWidth, coverageHeight, {
                fill: '#f8fafc',
                border: '#e2e8f0',
                radius: 12,
            });

            const coveragePadding = 12;
            const coverageBadgeW = 78;
            const coverageBadgeH = 24;
            const coverageBadgeX = scoreBoxLeft + scoreBoxWidth - coveragePadding - coverageBadgeW;
            const coverageBadgeY = coverageTop + coveragePadding;

            doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
            doc.text(summaryScoreTitle, scoreBoxLeft + coveragePadding, coverageTop + coveragePadding + 2, {
                width: scoreBoxWidth - (coveragePadding * 3) - coverageBadgeW,
            });

            const coverageColors = scoreColors(totalScoreCompletedParams);
            doc.save();
            if (typeof doc.roundedRect === 'function') {
                doc.roundedRect(coverageBadgeX, coverageBadgeY, coverageBadgeW, coverageBadgeH, 12).fillAndStroke(coverageColors.bg, coverageColors.border);
            } else {
                doc.rect(coverageBadgeX, coverageBadgeY, coverageBadgeW, coverageBadgeH).fillAndStroke(coverageColors.bg, coverageColors.border);
            }
            doc.restore();

            doc.font('Helvetica-Bold').fontSize(9).fillColor(coverageColors.fg);
            doc.text(
                totalScoreCompletedParams === null ? 'N/A' : `${totalScoreCompletedParams}%`,
                coverageBadgeX,
                coverageBadgeY + 7,
                { width: coverageBadgeW, align: 'center' }
            );

            doc.font('Helvetica').fontSize(9).fillColor('#64748b');
            doc.text(
                summaryScoreSubtitle,
                scoreBoxLeft + coveragePadding,
                coverageTop + coveragePadding + 28,
                { width: scoreBoxWidth - coveragePadding * 2 }
            );

            doc.y = coverageTop + coverageHeight + 10;
        }

        if (overallReason) {
            const reasonTextWidth = scoreBoxWidth - 28;
            doc.font('Helvetica').fontSize(10);
            const reasonTextHeight = Math.max(
                16,
                doc.heightOfString(overallReason, {
                    width: reasonTextWidth,
                    align: 'left',
                })
            );
            const reasonHeight = Math.max(78, 44 + reasonTextHeight);

            ensureSpace(doc, reasonHeight + 12, { companyName, continuedTitle: 'Interview Report Summary' });

            const reasonTop = doc.y;

            drawCard(doc, scoreBoxLeft, reasonTop, scoreBoxWidth, reasonHeight, {
                fill: '#f8fafc',
                border: '#e2e8f0',
                radius: 14,
            });

            doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Overall Summary', scoreBoxLeft + 14, reasonTop + 12);

            doc.font('Helvetica').fontSize(10).fillColor('#374151');
            doc.text(overallReason, scoreBoxLeft + 14, reasonTop + 30, {
                width: reasonTextWidth,
                align: 'left',
            });

            doc.y = reasonTop + reasonHeight + 10;
        }
    }

    // ✅ Communication & Clarity and Parameter-wise Evaluation (Speaking rounds only)
    if (!isCodingInterview && !isHumanOnly) {
        // Communication & Clarity
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Communication & Clarity');
        doc.moveDown(0.5);

        const commText = commReason || 'No communication feedback available.';
        const commBaseHeight = 64;
        const commExtra = Math.min(70, Math.max(0, Math.ceil(commText.length / 110) * 14));
        const commCardHeight = commBaseHeight + commExtra;

        ensureSpace(doc, commCardHeight + 12, { companyName, continuedTitle: 'Interview Report Summary' });

        const commCardTop = doc.y - 2;
        drawCard(doc, pageLeft, commCardTop, usableWidth, commCardHeight, {
            fill: '#f9fafb',
            border: '#e2e8f0',
            radius: 12,
        });

        const commPadding = 12;
        const commBadgeW = 72;
        const commBadgeH = 22;
        const commBadgeX = pageLeft + usableWidth - commPadding - commBadgeW;
        const commBadgeY = commCardTop + commPadding;

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
        doc.text('Score', pageLeft + commPadding, commCardTop + commPadding + 2, {
            width: usableWidth - (commPadding * 3) - commBadgeW,
        });

        const commColors = scoreColors(commScore);
        doc.save();
        if (typeof doc.roundedRect === 'function') {
            doc.roundedRect(commBadgeX, commBadgeY, commBadgeW, commBadgeH, 11).fillAndStroke(commColors.bg, commColors.border);
        } else {
            doc.rect(commBadgeX, commBadgeY, commBadgeW, commBadgeH).fillAndStroke(commColors.bg, commColors.border);
        }
        doc.restore();

        doc.font('Helvetica-Bold').fontSize(9).fillColor(commColors.fg);
        doc.text(commScore === null ? 'N/A' : `${commScore}%`, commBadgeX, commBadgeY + 6, { width: commBadgeW, align: 'center' });

        doc.font('Helvetica').fontSize(9.5).fillColor('#374151');
        doc.text(commText, pageLeft + commPadding, commCardTop + commPadding + 30, {
            width: usableWidth - commPadding * 2,
        });

        doc.y = commCardTop + commCardHeight + 12;

        // Video link
        if (videoRecordingUrl) {
            ensureSpace(doc, 55, { companyName, continuedTitle: 'Interview Report Summary' });
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Video Recording');
            doc.moveDown(0.3);

            doc.font('Helvetica').fontSize(10).fillColor('#2563eb').text('View recording', {
                link: videoRecordingUrl,
                underline: true,
            });

            doc.moveDown(0.6);
        }

        // Optional session link
        if (sessionLink) {
            ensureSpace(doc, 55, { companyName, continuedTitle: 'Interview Report Summary' });
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Session Link');
            doc.moveDown(0.3);

            doc.font('Helvetica').fontSize(10).fillColor('#2563eb').text('Open session', {
                link: sessionLink,
                underline: true,
            });

            doc.moveDown(0.6);
        }

        // Parameter-wise Evaluation
        ensureSpace(doc, 60, { companyName, continuedTitle: 'Interview Report Summary' });
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Parameter-wise Evaluation');
        doc.moveDown(0.4);

        if (parameterWiseScores.length) {
            const sorted = [...parameterWiseScores].sort((a, b) => a.name.localeCompare(b.name));

            sorted.forEach((p) => {
                const reasonText = p.reason || 'No detailed feedback available.';
                const baseHeight = 56;
                const extra = Math.min(60, Math.max(0, Math.ceil(reasonText.length / 120) * 14));
                const cardH = baseHeight + extra;

                ensureSpace(doc, cardH + 10, { companyName, continuedTitle: 'Interview Report Summary (continued)' });

                const x = pageLeft;
                const y = doc.y;
                const w = usableWidth;

                drawCard(doc, x, y, w, cardH, { fill: '#ffffff', border: '#e2e8f0', radius: 12 });

                const padding = 12;
                const badgeW = 72;
                const badgeH = 22;
                const badgeX = x + w - padding - badgeW;
                const badgeY = y + padding;

                doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
                doc.text(p.name, x + padding, y + padding + 2, { width: w - (padding * 3) - badgeW });

                const { bg, fg, border } = scoreColors(p.score);
                doc.save();
                if (typeof doc.roundedRect === 'function') doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 11).fillAndStroke(bg, border);
                else doc.rect(badgeX, badgeY, badgeW, badgeH).fillAndStroke(bg, border);
                doc.restore();

                doc.font('Helvetica-Bold').fontSize(9).fillColor(fg);
                doc.text(p.score === null ? 'N/A' : `${p.score}%`, badgeX, badgeY + 6, { width: badgeW, align: 'center' });

                doc.font('Helvetica').fontSize(9.5).fillColor('#374151');
                doc.text(reasonText, x + padding, y + padding + 30, { width: w - padding * 2 });

                if (p.group) {
                    doc.font('Helvetica').fontSize(8.5).fillColor('#64748b');
                    doc.text(`Group: ${p.group}`, x + padding, y + cardH - 18, { width: w - padding * 2 });
                }

                doc.y = y + cardH + 10;
            });
        } else {
            drawCard(doc, pageLeft, doc.y, usableWidth, 52, { fill: '#f8fafc', border: '#cbd5e1', radius: 12 });
            doc.font('Helvetica').fontSize(9.5).fillColor('#6b7280');
            doc.text('Parameter-wise scoring data is not available for this interview.', pageLeft + 12, doc.y + 14, {
                width: usableWidth - 24,
            });
            doc.y += 50;
        }
    } // End of speaking-only sections

    // Interviewer feedback section for Human interview modes
    if (isHumanInterviewer) {
        ensureSpace(doc, 120, { companyName, continuedTitle: 'Interview Report Summary (continued)' });
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Interviewer Feedback');
        doc.moveDown(0.3);

        if (!hasInterviewerFeedback) {
            drawCard(doc, pageLeft, doc.y, usableWidth, 48, { fill: '#f8fafc', border: '#cbd5e1', radius: 12 });
            doc.font('Helvetica').fontSize(9.5).fillColor('#6b7280');
            doc.text('No interviewer feedback has been submitted for this interview yet.', pageLeft + 12, doc.y + 14, {
                width: usableWidth - 24,
            });
            doc.y += 54;
        } else {
            const summaryLines = [];
            if (typeof feedbackRating === 'number' && feedbackRating > 0) summaryLines.push(`Overall Rating: ${feedbackRating}/5`);
            if (feedbackRecommendation) summaryLines.push(`Recommendation: ${feedbackRecommendation}`);
            if (feedbackSubmittedAtText) summaryLines.push(`Submitted At: ${feedbackSubmittedAtText}`);

            if (summaryLines.length) {
                ensureSpace(doc, 56, { companyName, continuedTitle: 'Interview Report Summary (continued)' });
                drawCard(doc, pageLeft, doc.y, usableWidth, 42, { fill: '#f8fafc', border: '#e2e8f0', radius: 10 });
                doc.font('Helvetica').fontSize(9.5).fillColor('#374151');
                doc.text(summaryLines.join('   |   '), pageLeft + 12, doc.y + 14, { width: usableWidth - 24 });
                doc.y += 48;
            }

            const feedbackSections = [
                { title: 'Strengths', value: feedbackStrengths, color: '#166534' },
                { title: 'Areas for Improvement', value: feedbackImprovements, color: '#92400e' },
                { title: 'Overall Comment', value: feedbackOverallComment, color: '#1f2937' },
            ].filter((section) => !!section.value);

            feedbackSections.forEach((section) => {
                const value = section.value || '';
                const minHeight = 58;
                const extraHeight = Math.min(90, Math.max(0, Math.ceil(value.length / 115) * 14));
                const cardHeight = minHeight + extraHeight;

                ensureSpace(doc, cardHeight + 10, { companyName, continuedTitle: 'Interview Report Summary (continued)' });
                const sectionY = doc.y;
                drawCard(doc, pageLeft, sectionY, usableWidth, cardHeight, { fill: '#ffffff', border: '#e2e8f0', radius: 12 });

                doc.font('Helvetica-Bold').fontSize(10).fillColor(section.color);
                doc.text(section.title, pageLeft + 12, sectionY + 12, { width: usableWidth - 24 });

                doc.font('Helvetica').fontSize(9.5).fillColor('#374151');
                doc.text(value, pageLeft + 12, sectionY + 30, { width: usableWidth - 24 });

                doc.y = sectionY + cardHeight + 8;
            });

            if (feedbackParameterRatings.length) {
                ensureSpace(doc, 60, { companyName, continuedTitle: 'Interview Report Summary (continued)' });
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Parameter-wise Ratings');
                doc.moveDown(0.3);

                feedbackParameterRatings.forEach((row) => {
                    const linePrefix = `- ${row.skill}${typeof row.rating === 'number' ? ` (${row.rating}/5)` : ''}`;
                    const lineText = row.comment ? `${linePrefix}: ${row.comment}` : linePrefix;
                    const extraHeight = Math.min(60, Math.max(0, Math.ceil(lineText.length / 120) * 12));
                    const rowHeight = 34 + extraHeight;

                    ensureSpace(doc, rowHeight + 8, { companyName, continuedTitle: 'Interview Report Summary (continued)' });
                    const rowY = doc.y;
                    drawCard(doc, pageLeft, rowY, usableWidth, rowHeight, { fill: '#ffffff', border: '#e2e8f0', radius: 10 });

                    doc.font('Helvetica').fontSize(9.2).fillColor('#374151');
                    doc.text(lineText, pageLeft + 12, rowY + 12, { width: usableWidth - 24 });

                    doc.y = rowY + rowHeight + 6;
                });
            }
        }
    }

    // Remote Proctoring
    ensureSpace(doc, 120, { companyName, continuedTitle: 'Interview Report Summary (continued)' });
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Remote Proctoring');
    doc.moveDown(0.3);

    if (remoteProctoring) {
        doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
        doc.text(
            'Remote proctoring was active during this interview. The summary below reflects violations detected by anti-cheat checks.',
            { width: usableWidth }
        );

        doc.moveDown(0.6);
        doc.font('Helvetica').fontSize(10).fillColor('#374151');

        if (rpViolationCount !== null) doc.text(`• Total violations detected: ${rpViolationCount}`);
        doc.text(`• Tabs change / window blur detected: ${yesNo(tabsEvents > 0)}`);
        doc.text(`• Camera interruptions / out of view: ${yesNo(cameraEvents > 0)}`);
        doc.text(`• Multiple faces detected: ${yesNo(multiFacesEvents > 0)}`);
        doc.text(`• Multiple voices detected: ${yesNo(multiVoicesEvents > 0)}`);
        doc.text('• External monitor detected: Not monitored');
        doc.text('• Plagiarism detected: Not monitored');
    } else {
        doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
        doc.text('Remote proctoring signals were not captured for this interview.', { width: usableWidth });

        doc.moveDown(0.6);
        doc.font('Helvetica').fontSize(10).fillColor('#374151');
        [
            'Tabs change detected: No',
            'External monitor detected: No',
            'Face out of view: No',
            'Multiple faces detected: No',
            'Plagiarism detected: No',
            'Multiple voices detected: No',
        ].forEach((line) => doc.text(`• ${line}`));
    }

    // ✅ Transcript (Speaking rounds only)
    if (!isCodingInterview && conversation?.messages?.length) {
        doc.addPage();
        drawHeader(doc, 'Interview Transcript', companyName);

        doc.font('Helvetica').fontSize(10).fillColor('#4b5563');
        doc.text('Conversation between interviewer and candidate for this interview.', { width: usableWidth });
        doc.moveDown(1);

        conversation.messages.forEach((m) => {
            const role = (m.role || '').toString().toLowerCase();
            let baseLabel = 'System';
            if (role === 'candidate' || role === 'user') baseLabel = 'Candidate';
            else if (role === 'assistant' || role === 'ai') baseLabel = 'Interviewer';

            const rawText = (() => {
                const c = m.content;
                if (!c) return '';
                if (typeof c === 'string') return c;
                if (Array.isArray(c)) return c.map((part) => (typeof part?.text === 'string' ? part.text : '')).join(' ').trim();
                if (typeof c === 'object' && c.text) return String(c.text);
                try { return JSON.stringify(c); } catch { return String(c); }
            })();

            // Strip [DisplayName] prefix from human interview STT messages
            const nameMatch = rawText.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
            const speakerName = nameMatch ? nameMatch[1].trim() : null;
            const text = nameMatch ? nameMatch[2].trim() : rawText;
            const speakerLabel = speakerName ? `${baseLabel} (${speakerName})` : baseLabel;

            if (!text.trim()) return;

            ensureSpace(doc, 90, { companyName, continuedTitle: 'Interview Transcript' });
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text(speakerLabel);
            doc.moveDown(0.2);
            doc.font('Helvetica').fontSize(10).fillColor('#111827').text(text, { width: usableWidth - 10, indent: 6 });
            doc.moveDown(0.8);
        });
    }

    doc.end();
    return doc;
}


