/* eslint-disable no-unused-vars */
import { useEffect, useState, Suspense } from 'react';
import { Box, Card, CardContent, Divider, Typography, Button, CircularProgress, Tabs, Tab, Chip, Avatar, IconButton, Menu, MenuItem, TextField, Select, FormControl, InputLabel, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import CodeIcon from '@mui/icons-material/Code';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';
import { useUiContextState } from '../../contexts/UiContext';
import { useInterviewContextState } from '../../contexts/InterviewContext';
import { useAuthContextState } from '../../contexts/AuthContext';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIModal from '../MUI/commonUI/MUIModal';
import FinalCodeReview from '../codingRound/FinalCodeReview';
import defaultAvatar from '../../assets/default_avatar.jpg';
import { setDocumentTitle } from '../../AppUtils/documentTitle';
import InterviewPlayback from './InterviewPlayback';

export default function InterviewDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [, setUiState] = useUiContextState();
    const [, setInterviewState] = useInterviewContextState();
    const [authState] = useAuthContextState();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const neutralCardShade = alpha(theme.palette.grey[400], isDark ? 0.18 : 0.12);
    const neutralCardBorder = alpha(theme.palette.grey[500], isDark ? 0.4 : 0.26);

    const [item, setItem] = useState(null);
    const [candidate, setCandidate] = useState(null);
    const [job, setJob] = useState(null);
    const [interviewersMap, setInterviewersMap] = useState({});

    // Interviewer feedback state
    const [feedbackForm, setFeedbackForm] = useState({ rating: 0, recommendation: '', strengths: '', improvements: '', overallComment: '' });
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [feedbackError, setFeedbackError] = useState('');
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [feedbackMode, setFeedbackMode] = useState('general'); // 'general' | 'parameter'
    const [paramRows, setParamRows] = useState([{ id: 1, skill: '', rating: 0, comment: '' }]);
    const [paramTemplateSaving, setParamTemplateSaving] = useState(false);
    const [paramTemplateSaved, setParamTemplateSaved] = useState(false);
    const [interviewerPrefFetched, setInterviewerPrefFetched] = useState(false);

    // Transcript state
    const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
    const [transcriptLoading, setTranscriptLoading] = useState(false);
    const [transcript, setTranscript] = useState(null);

    // Chat history state
    const [chatModalOpen, setChatModalOpen] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState(null);
    const [readingPassageAudioOpen, setReadingPassageAudioOpen] = useState(false);

    // Coding round state for test case navigation
    const [activeTestCase, setActiveTestCase] = useState(0);



    // Playback pipeline state
    const [playbackOpen, setPlaybackOpen] = useState(false);
    const [playbackManifest, setPlaybackManifest] = useState(null);
    const [playbackLoading, setPlaybackLoading] = useState(false);
    const [playbackError, setPlaybackError] = useState('');



    // Problem and test case state
    const [, setProblems] = useState([]);
    const [selectedProblem, setSelectedProblem] = useState(null);
    const [testCases, setTestCases] = useState([]);
    const [loadingProblems, setLoadingProblems] = useState(false);
    const [finalSubmission, setFinalSubmission] = useState(null);
    const [finalSubmissionLoading, setFinalSubmissionLoading] = useState(false);
    const [linkActionLoading, setLinkActionLoading] = useState(false);
    const [linkMessage, setLinkMessage] = useState('');
    const [activationModalOpen, setActivationModalOpen] = useState(false);
    const [activationHours, setActivationHours] = useState(48);
    const [activationStartAt, setActivationStartAt] = useState('');
    const [regenEvalOpen, setRegenEvalOpen] = useState(false);
    const [regenEvalLoading, setRegenEvalLoading] = useState(false);
    const [regenEvalError, setRegenEvalError] = useState('');
    const [scoreMenuAnchorEl, setScoreMenuAnchorEl] = useState(null);
    const [allParamScoresOpen, setAllParamScoresOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        (async () => {
            setUiState({ loadingMsg: 'Loading interview' });
            console.log('[InterviewDetail] Fetching interview schedule', { id });
            try {
                const doc = await fetchData(`/api/interviewschedules/${id}`);
                console.log("[InterviewDetail] Loaded interview via GET /api/interviewschedules/:id", {
                    id,
                    hasVideoUrl: !!doc?.videoRecordingUrl,
                    videoRecordingUrl: doc?.videoRecordingUrl || null
                });
                setItem(doc);

                if (doc?.candidate) {
                    console.log('[InterviewDetail] Fetching candidate', { candidateId: doc.candidate });
                    const c = await fetchData(`/api/candidates/${doc.candidate}`);
                    console.log('[InterviewDetail] Candidate loaded', { candidateId: doc.candidate, hasEmail: !!c?.email });
                    setCandidate(c);
                }
                if (doc?.job) {
                    console.log('[InterviewDetail] Fetching job', { jobId: doc.job });
                    const j = await fetchData(`/api/jobs/${doc.job}`);
                    console.log('[InterviewDetail] Job loaded', { jobId: doc.job, title: j?.title || null });
                    setJob(j);
                }
                console.log('[InterviewDetail] Fetching interviewers');
                const users = await fetchData('/api/users?role=interviewer');
                console.log('[InterviewDetail] Interviewers loaded', { count: (users || []).length });
                const map = {};
                (users || []).forEach(u => { map[u._id] = u; });
                setInterviewersMap(map);
            } finally {
                setUiState({ loadingMsg: null });
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const interviewCandidateName = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ').trim();
    const jobName = (job?.title || job?.internalTitle || '').trim();
    const interviewName = interviewCandidateName && jobName
        ? `${interviewCandidateName} - ${jobName}`
        : interviewCandidateName || jobName || item?.roundType || item?.interviewType || '';

    useEffect(() => {
        setDocumentTitle(interviewName || 'Interview Detail');
    }, [interviewName]);


    // Fetch interviewer's saved feedback parameter template
    useEffect(() => {
        if (interviewerPrefFetched) return;
        if (authState?.user?.role !== 'interviewer') return;
        if (!item) return;
        setInterviewerPrefFetched(true);
        fetchData('/api/interviewschedules/interviewer-preference')
            .then(res => {
                const params = res?.parameters || [];
                if (params.length > 0) {
                    setParamRows(params.map((s, i) => ({ id: i + 1, skill: s, rating: 0, comment: '' })));
                }
            })
            .catch(() => { });
    }, [authState, item, interviewerPrefFetched]);

    // Fetch problems and test cases for coding rounds
    useEffect(() => {
        if (!item || item.roundType !== 'Coding') return;

        (async () => {
            setLoadingProblems(true);
            try {
                console.log('[InterviewDetail] Fetching coding problems', { interviewId: id });
                // Fetch problems for this interview
                const problemsData = await fetchData(`/api/codejudge/interviews/${id}/problems`);
                if (problemsData && problemsData.problems) {
                    console.log('[InterviewDetail] Problems loaded', { count: problemsData.problems.length });
                    setProblems(problemsData.problems);

                    // Auto-select first problem if available
                    if (problemsData.problems.length > 0) {
                        const firstProblem = problemsData.problems[0];
                        setSelectedProblem(firstProblem);

                        console.log('[InterviewDetail] Fetching test cases', { problemId: firstProblem._id });
                        // Fetch test cases for the first problem
                        const testCasesData = await fetchData(`/api/codejudge/problems/${firstProblem._id}/testcases`);
                        if (testCasesData && testCasesData.testCases) {
                            console.log('[InterviewDetail] Test cases loaded', { count: testCasesData.testCases.length });
                            setTestCases(testCasesData.testCases);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load problems:', err);
            } finally {
                setLoadingProblems(false);
            }
        })();
    }, [item, id]);


    useEffect(() => {
        if (!item || item.roundType !== 'Coding' || !id) return;
        if (candidate?._id && finalSubmission) {
            console.log('[InterviewDetail] Final submission already loaded; skipping userId refetch');
            return;
        }
        let alive = true;

        (async () => {
            setFinalSubmissionLoading(true);
            try {
                const fetchFinal = async (withUserId) => {
                    const qs = withUserId && candidate?._id ? `?userId=${candidate._id}` : '';
                    const url = `/api/codejudge/interviews/${id}/final-submission${qs}`;
                    console.log('[InterviewDetail] Fetching final submission', {
                        interviewId: id,
                        candidateId: withUserId ? candidate?._id || null : null,
                        url
                    });
                    try {
                        const data = await fetchData(url);
                        console.log('[InterviewDetail] Final submission loaded', {
                            interviewId: id,
                            hasResults: Array.isArray(data?.results) && data.results.length > 0,
                            passed: data?.passedTestCases,
                            total: data?.totalTestCases,
                            status: data?.status
                        });
                        if (alive) setFinalSubmission(data || null);
                        return { ok: true, notFound: false };
                    } catch (err) {
                        const isNotFound = err?.status === 404 || (err?.message && err.message.toLowerCase().includes('no final submission'));
                        if (!isNotFound) {
                            console.error('[InterviewDetail] Failed to load final submission', err);
                        }
                        return { ok: false, notFound: isNotFound };
                    }
                };

                const hasUser = Boolean(candidate?._id);
                const primary = await fetchFinal(hasUser);
                if (!primary.ok && primary.notFound && hasUser) {
                    console.warn('[InterviewDetail] Final submission not found for userId; retrying without userId');
                    const fallback = await fetchFinal(false);
                    if (!fallback.ok && fallback.notFound) {
                        if (alive) setFinalSubmission(null);
                    }
                } else if (!primary.ok && primary.notFound && !hasUser) {
                    if (alive) setFinalSubmission(null);
                }
            } catch (err) {
                if (alive) setFinalSubmission(null);
            } finally {
                if (alive) setFinalSubmissionLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item, id, candidate?._id]);

    if (!item) {
        return (
            <Box sx={{ p: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    const interviewerNames = (item.interviewers || []).map(uid => {
        const u = interviewersMap[uid] || {};
        const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        return name || u.email || uid;
    });

    // ðŸ”¥ Evaluation score + color (0â€“100, split into 3 bands)
    const rawEvaluationScore =
        item?.evaluationScore ??
        item?.evaluation?.totalScore ??
        item?.evaluation?.score ??
        item?.evaluationBreakdown?.totalScore ??
        item?.evaluationBreakdown?.evaluationScore ??
        null;

    const evaluationScore =
        typeof rawEvaluationScore === 'number' && !Number.isNaN(rawEvaluationScore)
            ? Math.max(0, Math.min(100, rawEvaluationScore))
            : null;

    const isInterviewCompleted = Boolean(
        item?.status === 'Completed'
        || item?.status === 'completed'
        || item?.interviewStatus === 'Completed'
        || item?.interviewStatus === 'completed'
        || item?.completedAt
        || item?.evaluation?.completedAt
        || item?.evaluation?.totalScore !== undefined
        || item?.evaluationScore !== undefined
        || item?.evaluationBreakdown?.completedAt
        || item?.evaluationBreakdown?.totalScore !== undefined
    );
    const interviewTypeValue = String(item?.roundType || item?.interviewType || '').toLowerCase();
    const isCodingInterview = interviewTypeValue.includes('coding');
    const shouldShowTranscriptButton = isInterviewCompleted && !isCodingInterview;
    const readingPassageText = String(item?.readingPassageText || '').trim();
    const readingPassageAudioUrl = String(item?.readingPassageAudioUrl || '').trim();
    const hasReadingPassageAudio = Boolean(readingPassageText && readingPassageAudioUrl);

    // âœ… Overall evaluation / reason (backward compatible)
    const overallEvaluation =
        (typeof item?.overallReason === 'string' && item.overallReason.trim()) ||
        (typeof item?.evaluation?.overallReason === 'string' && item.evaluation.overallReason.trim()) ||
        (typeof item?.evaluation?.reason === 'string' && item.evaluation.reason.trim()) ||
        (typeof item?.evaluationReason === 'string' && item.evaluationReason.trim()) ||
        (typeof item?.evaluationBreakdown?.overallReason === 'string' && item.evaluationBreakdown.overallReason.trim()) ||
        (typeof item?.evaluationBreakdown?.evaluationReason === 'string' && item.evaluationBreakdown.evaluationReason.trim()) ||
        (typeof item?.evaluationBreakdown?.reason === 'string' && item.evaluationBreakdown.reason.trim()) ||
        null;

    // âœ… Parameter-wise evaluation normalization (name, score, reason)
    const parameterWiseRaw =
        item?.evaluation?.parameters ||
        item?.evaluationBreakdown?.parameters ||
        item?.evaluationBreakdown?.parameterWiseEvaluation ||
        item?.evaluationBreakdown?.parameterWiseScores ||
        item?.evaluationBreakdown?.parameterWise ||
        item?.parameterWiseEvaluation ||
        item?.evaluation?.parameterWise ||
        item?.evaluation?.parameterWiseScores ||
        null;

    const COMMUNICATION_PARAMETER_NAME = 'Communication & Clarity';

    const normalizeParamItem = (name, value) => {
        const cleanName = typeof name === 'string' ? name.trim() : '';
        if (!cleanName) return null;

        // value can be number
        if (typeof value === 'number') {
            return { name: cleanName, score: Math.max(0, Math.min(100, value)), reason: null, weight: 1, group: '' };
        }

        const scoreVal =
            value?.score ??
            value?.value ??
            value?.percentage ??
            value?.obtainedScore ??
            value?.totalScore ??
            null;

        const score =
            typeof scoreVal === 'number' && !Number.isNaN(scoreVal)
                ? Math.max(0, Math.min(100, scoreVal))
                : null;

        const reason =
            (typeof value?.reason === 'string' && value.reason.trim()) ||
            (typeof value?.feedback === 'string' && value.feedback.trim()) ||
            (typeof value?.comment === 'string' && value.comment.trim()) ||
            (typeof value?.summary === 'string' && value.summary.trim()) ||
            null;

        const weightVal =
            value?.weight ??
            value?.weightage ??
            value?.weightScore ??
            null;
        const weight =
            typeof weightVal === 'number' && Number.isFinite(weightVal) && weightVal > 0
                ? weightVal
                : 1;
        const group = typeof value?.group === 'string' ? value.group.trim() : '';

        return { name: cleanName, score, reason, weight, group };
    };

    const parameterWise = (() => {
        if (!parameterWiseRaw) return [];

        // Array form: [{name/parameterName, score, reason}]
        if (Array.isArray(parameterWiseRaw)) {
            return parameterWiseRaw
                .map((p) => {
                    const name =
                        (typeof p?.parameterName === 'string' && p.parameterName.trim()) ||
                        (typeof p?.name === 'string' && p.name.trim()) ||
                        (typeof p?.title === 'string' && p.title.trim()) ||
                        (typeof p?.parameter?.name === 'string' && p.parameter.name.trim()) ||
                        '';
                    return normalizeParamItem(name, p);
                })
                .filter(Boolean);
        }

        // Object form
        if (typeof parameterWiseRaw === 'object') {
            // Nested lists
            if (Array.isArray(parameterWiseRaw.parameters)) {
                return parameterWiseRaw.parameters
                    .map((p) => {
                        const name =
                            (typeof p?.parameterName === 'string' && p.parameterName.trim()) ||
                            (typeof p?.name === 'string' && p.name.trim()) ||
                            (typeof p?.title === 'string' && p.title.trim()) ||
                            (typeof p?.parameter?.name === 'string' && p.parameter.name.trim()) ||
                            '';
                        return normalizeParamItem(name, p);
                    })
                    .filter(Boolean);
            }

            if (Array.isArray(parameterWiseRaw.scores)) {
                return parameterWiseRaw.scores
                    .map((p) => {
                        const name =
                            (typeof p?.parameterName === 'string' && p.parameterName.trim()) ||
                            (typeof p?.name === 'string' && p.name.trim()) ||
                            (typeof p?.title === 'string' && p.title.trim()) ||
                            (typeof p?.parameter?.name === 'string' && p.parameter.name.trim()) ||
                            '';
                        return normalizeParamItem(name, p);
                    })
                    .filter(Boolean);
            }

            // Map form: { "Communication": 70 } OR { "Communication": {score, reason} }
            return Object.entries(parameterWiseRaw)
                .map(([k, v]) => normalizeParamItem(k, v))
                .filter(Boolean);
        }

        return [];
    })();

    const parameterEvidenceStats =
        item?.evaluationBreakdown?.parameterEvidenceStats ||
        item?.evaluation?.breakdown?.parameterEvidenceStats ||
        item?.evaluationBreakdown?.breakdown?.parameterEvidenceStats ||
        item?.evaluation?.parameterEvidenceStats ||
        item?.parameterEvidenceStats ||
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

    const totalParamCount = parameterWise.length;
    const scoredParams = parameterWise.filter((param) => typeof param.score === 'number' && !Number.isNaN(param.score));
    const allWeightSum = scoredParams.reduce((acc, param) => acc + getParamWeight(param), 0);
    const allWeightedSum = scoredParams.reduce((acc, param) => acc + param.score * getParamWeight(param), 0);
    const totalScoreAllParams = allWeightSum > 0 ? Math.round(allWeightedSum / allWeightSum) : null;

    const completedParams = scoredParams.filter(isParamCovered);
    const completedParamCount = completedParams.length;
    const completedWeightSum = completedParams.reduce((acc, param) => acc + getParamWeight(param), 0);
    const completedWeightedSum = completedParams.reduce((acc, param) => acc + param.score * getParamWeight(param), 0);
    const totalScoreCompletedParams =
        completedWeightSum > 0 ? Math.round(completedWeightedSum / completedWeightSum) : null;

    // NEW: load transcript for this interview (candidate+job)
    const handleOpenTranscript = async () => {
        setTranscriptModalOpen(true);
        setTranscriptLoading(true);
        try {
            if (!item?.candidate || !item?.job) {
                console.warn('[InterviewDetail] Transcript request missing candidate/job', {
                    interviewId: item?._id,
                    candidateId: item?.candidate,
                    jobId: item?.job
                });
                setTranscript(null);
                return;
            }

            const res = await fetchData(`/api/interviewschedules/${item._id}/transcript`);
            const conv = res?.conversation || null;
            const messagesCount = Array.isArray(conv?.messages) ? conv.messages.length : 0;
            if (!conv || messagesCount === 0) {
                console.warn('[InterviewDetail] Transcript empty for schedule', item?._id, {
                    conversationId: conv?._id || null,
                    messagesCount
                });
            }
            setTranscript(conv || null);
        } catch (err) {
            console.error('Failed to load transcript', err);
            setTranscript(null);
        } finally {
            setTranscriptLoading(false);
        }
    };
    const handleOpenChat = async () => {
        setChatModalOpen(true);
        setChatLoading(true);
        try {
            console.log("[ChatLoad] Fetching chat for interview:", item._id);
            const res = await fetchData(`/api/interviewschedules/${item._id}/chat`);
            console.log("[ChatLoad] Response:", res);
            console.log("[ChatLoad] Messages count:", res?.chat?.messages?.length ?? 0);
            setChatHistory(res?.chat || null);
        } catch (err) {
            console.error('[ChatLoad] Failed to load chat history', err);
            setChatHistory(null);
        } finally {
            setChatLoading(false);
        }
    };

    // Helper to extract text and optional [Name] prefix from message content
    const parseMessageContent = (content) => {
        let raw = '';
        if (!content) return { name: null, text: '' };
        if (typeof content === 'string') raw = content;
        else if (Array.isArray(content)) {
            raw = content.map(part => (typeof part?.text === 'string' ? part.text : '')).join(' ').trim();
        } else if (typeof content === 'object' && content.text) {
            raw = String(content.text);
        } else {
            try { raw = JSON.stringify(content); } catch { raw = String(content); }
        }
        // Strip [DisplayName] prefix added by human interview STT persistence
        const match = raw.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
        if (match) return { name: match[1].trim(), text: match[2].trim() };
        return { name: null, text: raw };
    };

    const getMessageText = (content) => parseMessageContent(content).text;

    const getSpeakerLabel = (role, name) => {
        if (!role) return 'Unknown';
        const r = String(role).toLowerCase();
        let label;
        if (r === 'candidate' || r === 'user') label = 'Candidate';
        else if (r === 'assistant' || r === 'ai' || r === 'system') label = 'Interviewer';
        else label = role;
        return name ? `${label} (${name})` : label;
    };

    // NEW: download video recording from Firebase WITHOUT fetch (no CORS issue)
    const handleDownloadVideo = () => {
        const url = item?.videoRecordingUrl;

        console.log("[InterviewDetail] Download Video clicked", {
            interviewId: item?._id,
            urlPresent: !!url,
            url
        });

        if (!url) {
            console.error("[InterviewDetail] No videoRecordingUrl found for this interview", {
                interviewId: item?._id
            });
            return;
        }

        const a = document.createElement("a");
        a.href = url;

        const ext =
            url.includes(".mp4") ? "mp4" :
                url.includes(".webm") ? "webm" :
                    "webm";

        a.download = `interview_${item._id || "recording"}.${ext}`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        if (item?._id) {
            void fetchData('/api/ai/recording-auth/cleanup', {
                method: 'POST',
                body: { interviewScheduleId: item._id }
            }).catch((err) => {
                console.warn('[InterviewDetail] Cleanup after download failed', err);
            });
        }
    };


    // NEW: download interview report (PDF) USING fetchData
    const handleDownloadReport = async () => {
        if (!item?._id) return;

        try {
            // fetchData already attaches Authorization + CSRF
            const blob = await fetchData(`/api/interviewschedules/${item._id}/report`, {
                method: 'GET'
            });

            // Safety check
            if (!(blob instanceof Blob)) {
                console.error('Expected Blob for report download, got:', blob);
                return;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');

            const candidateName =
                (candidate
                    ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
                    : 'candidate') || 'candidate';

            a.href = url;
            a.download = `InterviewReport_${candidateName}_${item._id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error while downloading report', err);
        }
    };

    // Playback: fetch initial manifest (first 8 chunks per track) then open player
    const handleOpenPlayback = async () => {
        if (!item?._id) return;
        setPlaybackLoading(true);
        setPlaybackError('');
        try {
            const res = await fetchData('/api/ai/recording-auth/playback-manifest', {
                method: 'POST',
                body: { interviewScheduleId: item._id }
            });
            if (res?.ok && res?.tracks?.length > 0) {
                setPlaybackManifest(res);
                setPlaybackOpen(true);
            } else {
                setPlaybackError('No recording segments found yet. Try generating the recording first.');
            }
        } catch (err) {
            console.error('[InterviewDetail] Playback manifest error:', err);
            setPlaybackError(err?.error || err?.message || 'Failed to load playback.');
        } finally {
            setPlaybackLoading(false);
        }
    };



    const displayTotalScore =
        evaluationScore !== null ? Math.round(evaluationScore) : totalScoreAllParams;


    const bandLabel =
        displayTotalScore === null
            ? 'N/A'
            : displayTotalScore < 33
                ? 'Low'
                : displayTotalScore < 67
                    ? 'Medium'
                    : 'High';

    // const hasEvaluation = evaluationScore !== null || !!overallEvaluation || parameterWise.length > 0;
    const scoreBand = (score) => {
        if (typeof score !== 'number' || Number.isNaN(score)) {
            return {
                label: 'N/A',
                color: theme.palette.text.secondary,
                bg: alpha(theme.palette.text.secondary, isDark ? 0.2 : 0.12),
            };
        }
        if (score < 33) {
            return {
                label: 'Low',
                color: theme.palette.error.main,
                bg: alpha(theme.palette.error.main, isDark ? 0.2 : 0.12),
            };
        }
        if (score < 67) {
            return {
                label: 'Medium',
                color: theme.palette.warning.main,
                bg: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12),
            };
        }
        return {
            label: 'High',
            color: theme.palette.success.main,
            bg: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
        };
    };

    const totalBand = scoreBand(displayTotalScore);
    const coveredBand = scoreBand(totalScoreCompletedParams);
    // const gaugeAngle = evaluationScore !== null ? Math.round((evaluationScore / 100) * 180) : 0;
    const isHumanAI = item?.interviewerType === 'Human+AI';
    const candidateName = candidate
        ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email
        : 'â€”';
    const candidateRole = job?.title || item?.interviewType || item?.roundType || 'â€”';
    const candidatePhone = candidate?.phoneNumber
        ? `${candidate.countryCode ? `${candidate.countryCode} ` : ''}${candidate.phoneNumber}`.trim()
        : 'â€”';
    const candidateEmail = candidate?.email || 'â€”';
    const candidateInitials = candidateName && candidateName !== 'â€”'
        ? candidateName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
        : 'C';
    const candidateAvatar =
        candidate?.profileUrl ||
        candidate?.profileImage ||
        candidate?.photoUrl ||
        candidate?.imageUrl ||
        defaultAvatar;
    const meetingValue = item?.interviewMode === 'Onsite'
        ? (item?.locationAddress || 'â€”')
        : (item?.meetingLink || item?.webrtcLink || 'â€”');
    const meetingHref = (() => {
        const raw = item?.meetingLink || item?.webrtcLink || null;
        if (!raw) return null;
        // Interviewers are authenticated and must not consume the candidate's single-use token.
        // Strip the token param so they access the room without triggering token validation.
        const isHumanLed = item?.interviewerType === 'Human' || item?.interviewerType === 'Human+AI';
        if (item?.interviewMode === 'Virtual' && isHumanLed) {
            try {
                const url = new URL(raw);
                url.searchParams.delete('token');
                return url.toString();
            } catch {
                return raw;
            }
        }
        return raw;
    })();
    const meetingDisplay = (() => {
        if (!meetingValue || meetingValue === 'â€”') return 'â€”';
        if (item?.interviewMode === 'Onsite') return meetingValue;
        const raw = meetingHref || meetingValue;
        try {
            const url = new URL(raw);
            const cleaned = `${url.host}${url.pathname}${url.search}`;
            return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
        } catch (err) {
            const trimmed = String(raw || '');
            return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
        }
    })();
    const headerSubtitle = item?.interviewType || item?.roundType || 'Evaluation';
    const aiFeedback =
        (typeof item?.evaluation?.feedback === 'string' && item.evaluation.feedback.trim()) ||
        (typeof item?.evaluationBreakdown?.feedback === 'string' && item.evaluationBreakdown.feedback.trim()) ||
        (typeof item?.evaluation?.summary === 'string' && item.evaluation.summary.trim()) ||
        overallEvaluation ||
        item?.notes ||
        'Feedback will appear after evaluation is completed.';
    const interviewStartAt = item?.startAt ? new Date(item.startAt) : null;
    const interviewEndedAt = item?.endedAt ? new Date(item.endedAt) : null;
    const scheduledDurationMinutes = item?.durationMinutes || null;
    const rawActualDurationMinutes = interviewStartAt && interviewEndedAt
        ? Math.max(1, Math.round((interviewEndedAt - interviewStartAt) / 60000))
        : null;
    const actualDurationMinutes = rawActualDurationMinutes !== null && scheduledDurationMinutes
        ? Math.min(rawActualDurationMinutes, scheduledDurationMinutes)
        : rawActualDurationMinutes;
    const linkExpiresAt = item?.webrtcAccessExpiresAt
        ? new Date(item.webrtcAccessExpiresAt)
        : (interviewStartAt ? new Date(interviewStartAt.getTime() + 48 * 60 * 60 * 1000) : null);
    const isLinkExpired = linkExpiresAt ? Date.now() > linkExpiresAt.getTime() : false;
    const isLinkUsed = Boolean(item?.webrtcAccessUsedAt);
    const hasVirtualLink = item?.interviewMode === 'Virtual' && (item?.webrtcLink || item?.meetingLink);
    const canActivateLink = item?.interviewMode === 'Virtual' && !isLinkExpired;
    const formatTestValue = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch (err) {
                return String(value);
            }
        }
        return String(value);
    };
    const isEmptyTestValue = (value) => {
        if (value === null || value === undefined || value === '') return true;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return true;
            if (trimmed === '{}' || trimmed === '{"results":[null]}' || trimmed === '{"results":[]}') {
                return true;
            }
            if (/^\{\s*"results"\s*:\s*\[\s*null\s*\]\s*\}$/.test(trimmed)) {
                return true;
            }
        }
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') {
            const results = Array.isArray(value.results) ? value.results : null;
            if (results && results.length > 0) {
                return results.every((item) => item === null || item === undefined || item === '');
            }
            const entries = Object.values(value || {});
            if (entries.length > 0) {
                const allEmpty = entries.every((entry) => {
                    if (entry === null || entry === undefined || entry === '') return true;
                    if (Array.isArray(entry)) return entry.length === 0 || entry.every((item) => item === null || item === undefined || item === '');
                    if (typeof entry === 'object') {
                        try {
                            const serialized = JSON.stringify(entry);
                            return serialized === '{}' || serialized === '{"results":[null]}' || serialized === '{"results":[]}';
                        } catch {
                            return false;
                        }
                    }
                    return false;
                });
                if (allEmpty) return true;
            }
            try {
                const serialized = JSON.stringify(value);
                return serialized === '{}' || serialized === '{"results":[null]}' || serialized === '{"results":[]}';
            } catch {
                return false;
            }
        }
        return false;
    };
    const resolveTestValue = (primary, fallback) => {
        if (!isEmptyTestValue(primary)) return formatTestValue(primary);
        return formatTestValue(fallback);
    };
    const getTestResultBadge = (tc) => {
        const statusObj = tc?.status;
        const statusLabel = typeof statusObj === 'string'
            ? statusObj
            : (statusObj?.label || statusObj?.description || '');
        const raw = (tc?.result || statusLabel || tc?.outcome || '').toString().toLowerCase();
        const passed = tc?.passed === true || tc?.isCorrect === true || statusObj?.id === 3 || raw.includes('pass') || raw.includes('accept') || raw.includes('correct');
        const failed = tc?.passed === false || tc?.isCorrect === false || statusObj?.id === 4 || raw.includes('fail') || raw.includes('wrong') || raw.includes('error');
        if (passed) {
            return {
                label: 'Pass',
                color: theme.palette.success.main,
                bg: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
            };
        }
        if (failed) {
            return {
                label: 'Fail',
                color: theme.palette.error.main,
                bg: alpha(theme.palette.error.main, isDark ? 0.2 : 0.12),
            };
        }
        return {
            label: '—',
            color: theme.palette.text.secondary,
            bg: alpha(theme.palette.text.secondary, isDark ? 0.2 : 0.12),
        };
    };
    const testCaseStats = (() => {
        const passed = finalSubmission?.passedTestCases ?? finalSubmission?.passed ?? null;
        const total = finalSubmission?.totalTestCases ?? finalSubmission?.total ?? null;
        if (typeof passed === 'number' && typeof total === 'number') {
            return { total, passed, failed: Math.max(0, total - passed) };
        }
        const rows = (finalSubmission?.results && finalSubmission.results.length > 0)
            ? finalSubmission.results
            : testCases;
        if (!rows || rows.length === 0) return null;
        let countedPassed = 0;
        let countedFailed = 0;
        rows.forEach((tc) => {
            const badge = getTestResultBadge(tc);
            if (badge.label === 'Pass') countedPassed += 1;
            if (badge.label === 'Fail') countedFailed += 1;
        });
        return { total: rows.length, passed: countedPassed, failed: countedFailed };
    })();
    const testCaseRows = (finalSubmission?.results && finalSubmission.results.length > 0)
        ? finalSubmission.results
        : (Array.isArray(testCases) ? testCases : []);
    const hasResultRows = Boolean(finalSubmission?.results && finalSubmission.results.length > 0);
    const shouldShowTestCaseCard = finalSubmissionLoading || Boolean(finalSubmission) || (testCaseRows.length > 0);
    const testCaseByOrder = new Map();
    const testCaseById = new Map();
    (Array.isArray(testCases) ? testCases : []).forEach((tc, idx) => {
        const orderKey = String(tc?.order ?? tc?.testCaseId?.order ?? (idx + 1));
        testCaseByOrder.set(orderKey, tc);
        if (tc?._id) {
            testCaseById.set(String(tc._id), tc);
        }
        if (tc?.id) {
            testCaseById.set(String(tc.id), tc);
        }
    });
    const summaryResultBadge = (() => {
        if (!finalSubmission) return null;
        const passed = finalSubmission?.passedTestCases ?? finalSubmission?.passed;
        const total = finalSubmission?.totalTestCases ?? finalSubmission?.total;
        if (typeof passed === 'number' && typeof total === 'number' && total > 0) {
            if (passed === total) {
                return {
                    label: 'Pass',
                    color: theme.palette.success.main,
                    bg: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
                };
            }
            if (passed === 0) {
                return {
                    label: 'Fail',
                    color: theme.palette.error.main,
                    bg: alpha(theme.palette.error.main, isDark ? 0.2 : 0.12),
                };
            }
            return {
                label: 'Partial',
                color: theme.palette.warning.main,
                bg: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12),
            };
        }
        const status = (finalSubmission?.status || '').toString().toLowerCase();
        if (status.includes('accept')) {
            return {
                label: 'Pass',
                color: theme.palette.success.main,
                bg: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
            };
        }
        if (status.includes('wrong') || status.includes('fail') || status.includes('error')) {
            return {
                label: 'Fail',
                color: theme.palette.error.main,
                bg: alpha(theme.palette.error.main, isDark ? 0.2 : 0.12),
            };
        }
        return null;
    })();

    const handleRegenerateEvaluation = async () => {
        if (!item?._id) return;
        const candidateId = candidate?._id || item?.candidate;
        const jobId = job?._id || item?.job;
        if (!candidateId || !jobId) {
            setRegenEvalError('Candidate or job is missing for this interview.');
            return;
        }
        setRegenEvalLoading(true);
        setRegenEvalError('');
        try {
            await fetchData('/api/ai/evaluateInterview', {
                method: 'POST',
                body: {
                    candidateId,
                    jobId,
                    interviewScheduleId: item._id
                }
            });
            const refreshed = await fetchData(`/api/interviewschedules/${item._id}`);
            if (refreshed) setItem(refreshed);
            setRegenEvalOpen(false);
        } catch (err) {
            console.error('Failed to regenerate evaluation', err);
            setRegenEvalError(err?.error || err?.message || 'Failed to regenerate evaluation.');
        } finally {
            setRegenEvalLoading(false);
        }
    };

    const scoreMenuOpen = Boolean(scoreMenuAnchorEl);
    const handleOpenScoreMenu = (event) => {
        setScoreMenuAnchorEl(event.currentTarget);
    };
    const handleCloseScoreMenu = () => {
        setScoreMenuAnchorEl(null);
    };
    const handleViewAllParameterScores = () => {
        handleCloseScoreMenu();
        setAllParamScoresOpen(true);
    };
    const handleOpenRegenerateFromMenu = () => {
        handleCloseScoreMenu();
        setRegenEvalError('');
        setRegenEvalOpen(true);
    };

    const handleActivateAndReshare = async (hoursOverride) => {
        if (!item?._id) return;
        setLinkActionLoading(true);
        setLinkMessage('');
        try {
            const updated = await fetchData(`/api/interviewschedules/${item._id}/activate-reshare`, {
                method: 'POST',
                body: {
                    activeWindowHours: hoursOverride || activationHours,
                    scheduleStartAt: activationStartAt ? new Date(activationStartAt).toISOString() : null,
                }
            });
            if (updated) {
                setItem(updated);
            }
            try {
                const refreshed = await fetchData(`/api/interviewschedules/${item._id}`);
                if (refreshed) setItem(refreshed);
            } catch (refreshErr) {
                console.warn('[InterviewDetail] Failed to refresh interview after reshare', refreshErr);
            }
            setInterviewState({ interviewListRefreshToken: Date.now() });
            setLinkMessage('Interview link activated and shared with the candidate.');
        } catch (err) {
            console.error('Failed to activate link', err);
            setLinkMessage(err?.error || err?.message || 'Failed to activate and reshare link.');
        } finally {
            setLinkActionLoading(false);
        }
    };

    return (
        <>
            <Box
                sx={{
                    minHeight: '100vh',
                    bgcolor: 'background.default',
                    py: { xs: 1, md: 1.5 }
                }}
            >
                <Card sx={{ background: 'transparent', boxShadow: 'none', border: 0 }}>
                    <CardContent sx={{ p: 0 }}>
                        <Box
                            sx={{
                                px: { xs: 2, sm: 3, md: 5 },
                                pt: { xs: 1, sm: 1.5, md: 2 },
                                pb: { xs: 2, sm: 3, md: 5 },
                                mx: { xs: 0, sm: "1vw" },
                                my: { xs: 0, sm: 0.5 },
                            }}
                        >
                            <CardContent sx={{ p: 0 }}>
                                <Button
                                    startIcon={<ArrowBackIosIcon />}
                                    onClick={() => navigate(-1)}
                                    sx={{
                                        mb: 1,
                                        textTransform: "none",
                                        fontWeight: 600,
                                        color: 'primary.main',
                                        borderRadius: 2,
                                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08) },
                                    }}
                                >
                                    Back
                                </Button>

                                {/* TITLE */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        mb: 1.25,
                                    }}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                Interview Detail - {headerSubtitle}
                                            </Typography>
                                            {(hasVirtualLink || isLinkExpired || linkExpiresAt) && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                    {(hasVirtualLink || isLinkExpired) && (
                                                        <Chip
                                                            label={isLinkExpired ? 'Link expired' : (isLinkUsed ? 'Link used' : 'Link active')}
                                                            color={isLinkExpired ? 'error' : (isLinkUsed ? 'warning' : 'success')}
                                                            size="small"
                                                        />
                                                    )}
                                                    {linkExpiresAt && (
                                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                            Link valid until {linkExpiresAt.toLocaleString()}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
                                        </Box>
                                        {linkMessage && (
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                {linkMessage}
                                            </Typography>
                                        )}
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        {item?.interviewMode === 'Virtual' && (
                                            <MUIButton
                                                variant="contained"
                                                sx={{
                                                    borderRadius: 2,
                                                    textTransform: "none",
                                                    fontWeight: 600,
                                                }}
                                                onClick={() => {
                                                    // Default to 10 minutes from now
                                                    const d = new Date(Date.now() + 10 * 60 * 1000);
                                                    const pad = n => String(n).padStart(2, '0');
                                                    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                                    setActivationStartAt(local);
                                                    setActivationModalOpen(true);
                                                }}
                                                disabled={linkActionLoading}
                                            >
                                                {linkActionLoading ? 'Activating...' : 'Activate & Reshare Link'}
                                            </MUIButton>
                                        )}
                                        {isInterviewCompleted && (
                                            <>
                                                {shouldShowTranscriptButton && (
                                                    <MUIButton
                                                        variant="outlined"
                                                        sx={{
                                                            borderRadius: 2,
                                                            textTransform: "none",
                                                            fontWeight: 600,
                                                        }}
                                                        onClick={handleOpenTranscript}
                                                    >
                                                        View Transcript
                                                    </MUIButton>
                                                )}
                                                {(item?.interviewerType === 'Human' || item?.interviewerType === 'Human+AI') && (
                                                    <MUIButton
                                                        variant="outlined"
                                                        sx={{
                                                            borderRadius: 2,
                                                            textTransform: "none",
                                                            fontWeight: 600,
                                                        }}
                                                        onClick={handleOpenChat}
                                                    >
                                                        View Chat
                                                    </MUIButton>
                                                )}
                                                <MUIButton
                                                    variant="outlined"
                                                    sx={{
                                                        borderRadius: 2,
                                                        textTransform: "none",
                                                        fontWeight: 600,
                                                    }}
                                                    onClick={handleDownloadReport}
                                                >
                                                    Download Report
                                                </MUIButton>
                                            </>
                                        )}

                                        {item.videoRecordingUrl && (
                                            <MUIButton
                                                variant="outlined"
                                                sx={{
                                                    borderRadius: 2,
                                                    textTransform: "none",
                                                    fontWeight: 600,
                                                }}
                                                onClick={handleDownloadVideo}
                                            >
                                                Download Video
                                            </MUIButton>
                                        )}

                                        {hasReadingPassageAudio && (
                                            <MUIButton
                                                variant="outlined"
                                                sx={{
                                                    borderRadius: 2,
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                }}
                                                onClick={() => setReadingPassageAudioOpen(true)}
                                            >
                                                Listen Passage Audio
                                            </MUIButton>
                                        )}

                                        {/* Watch Playback — instant, no MP4 generation needed */}
                                        {isInterviewCompleted && (
                                            <MUIButton
                                                variant="outlined"
                                                disabled={playbackLoading}
                                                sx={{
                                                    borderRadius: 2,
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                }}
                                                onClick={handleOpenPlayback}
                                            >
                                                {playbackLoading ? 'Loading…' : '▶ Watch Playback'}
                                            </MUIButton>
                                        )}
                                        {playbackError && (
                                            <Typography variant="caption" sx={{ color: 'error.main', alignSelf: 'center' }}>
                                                {playbackError}
                                            </Typography>
                                        )}


                                    </Box>

                                </Box>
                                <Divider sx={{ mb: 2 }} />

                                {/* Candidate Summary */}
                                <Card
                                    sx={{
                                        borderRadius: 3,
                                        bgcolor: 'background.paper',
                                        backdropFilter: 'blur(12px)',
                                        border: 1,
                                        borderColor: 'divider',
                                        boxShadow: 1,
                                    }}
                                >
                                    <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
                                                gap: 2,
                                                alignItems: 'stretch'
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                                <Avatar
                                                    variant="rounded"
                                                    src={candidateAvatar}
                                                    alt={candidateName}
                                                    sx={{
                                                        width: 92,
                                                        height: 92,
                                                        fontWeight: 700,
                                                        bgcolor: neutralCardShade,
                                                        color: 'primary.main',
                                                        borderRadius: 2,
                                                        border: 1,
                                                        borderColor: neutralCardBorder,
                                                        boxShadow: 1,
                                                    }}
                                                >
                                                    {candidateInitials}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                        {candidateName}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                                        {candidateRole}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: 'text.secondary' }}>
                                                            <PhoneOutlinedIcon sx={{ fontSize: 16 }} />
                                                            <Typography variant="caption">{candidatePhone}</Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: 'text.secondary' }}>
                                                            <MailOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                                                            <Typography variant="caption">{candidateEmail}</Typography>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </Box>

                                            <Box
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: {
                                                        xs: '1fr',
                                                        sm: 'minmax(220px, 1.3fr) minmax(120px, 0.7fr) minmax(300px, 1.8fr)',
                                                    },
                                                    gap: 1.5
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        p: 1.5,
                                                        minWidth: 0,
                                                        borderRadius: 2,
                                                        bgcolor: neutralCardShade,
                                                        border: 1,
                                                        borderColor: neutralCardBorder,
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                                                        Job
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        noWrap
                                                        title={job?.title || job?.internalTitle || '—'}
                                                        sx={{ fontWeight: 600, display: 'block' }}
                                                    >
                                                        {job?.title || job?.internalTitle || '—'}
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        p: 1.5,
                                                        borderRadius: 2,
                                                        bgcolor: neutralCardShade,
                                                        border: 1,
                                                        borderColor: neutralCardBorder,
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                                                        Mode
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {item?.interviewMode || '—'}
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        p: 1.5,
                                                        minWidth: 0,
                                                        borderRadius: 2,
                                                        bgcolor: neutralCardShade,
                                                        border: 1,
                                                        borderColor: neutralCardBorder,
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <LinkOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                                                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                                                            {item?.interviewMode === 'Onsite' ? 'Location' : 'Meeting Link'}
                                                        </Typography>
                                                    </Box>
                                                    {item?.interviewMode === 'Onsite' ? (
                                                        <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                            {meetingValue}
                                                        </Typography>
                                                    ) : meetingHref ? (
                                                        <Typography
                                                            component="a"
                                                            href={meetingHref}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={meetingHref}
                                                            noWrap
                                                            sx={{
                                                                fontWeight: 600,
                                                                color: 'primary.main',
                                                                textDecoration: 'underline',
                                                                maxWidth: '100%',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                display: 'block'
                                                            }}
                                                        >
                                                            {meetingDisplay}
                                                        </Typography>
                                                    ) : (
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {meetingValue}
                                                        </Typography>
                                                    )}
                                                </Box>

                                                {/* Interview Duration — full-width row */}
                                                <Box
                                                    sx={{
                                                        gridColumn: { sm: '1 / -1' },
                                                        px: 2,
                                                        py: 1.25,
                                                        borderRadius: 2,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 2,
                                                        flexWrap: 'wrap',
                                                        bgcolor: actualDurationMinutes !== null
                                                            ? alpha(theme.palette.primary.main, isDark ? 0.1 : 0.06)
                                                            : neutralCardShade,
                                                        border: 1,
                                                        borderColor: actualDurationMinutes !== null
                                                            ? alpha(theme.palette.primary.main, isDark ? 0.3 : 0.18)
                                                            : neutralCardBorder,
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                        Interview Duration
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                                        {actualDurationMinutes !== null ? (
                                                            <>
                                                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4 }}>
                                                                    <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'primary.main', lineHeight: 1 }}>
                                                                        {actualDurationMinutes}
                                                                    </Typography>
                                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                                                        min
                                                                    </Typography>
                                                                    <Chip
                                                                        label="actual"
                                                                        size="small"
                                                                        sx={{
                                                                            height: 18,
                                                                            fontSize: '0.65rem',
                                                                            fontWeight: 700,
                                                                            ml: 0.25,
                                                                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                                                                            color: 'primary.main',
                                                                        }}
                                                                    />
                                                                </Box>
                                                                {scheduledDurationMinutes && scheduledDurationMinutes !== actualDurationMinutes && (
                                                                    <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                                                        Scheduled: {scheduledDurationMinutes} min
                                                                    </Typography>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                                                {scheduledDurationMinutes ? `${scheduledDurationMinutes} min (scheduled)` : '—'}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>

                                {item.roundType !== 'Coding' && item?.interviewerType !== 'Human' && (
                                    <Box
                                        sx={{
                                            mt: 2,
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', lg: '320px 1fr' },
                                            gap: 2
                                        }}
                                    >
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            <Card
                                                sx={{
                                                    borderRadius: 3,
                                                    bgcolor: 'background.paper',
                                                    backdropFilter: 'blur(10px)',
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    boxShadow: 1,
                                                }}
                                            >
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                                {isHumanAI ? 'Holistic Interview Score' : 'Covered Parameters Score'}
                                                            </Typography>
                                                            <IconButton
                                                                size="small"
                                                                onClick={handleOpenScoreMenu}
                                                                disabled={regenEvalLoading}
                                                                sx={{ color: 'text.secondary' }}
                                                            >
                                                                <MoreVertIcon fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                        <Chip
                                                            label={coveredBand.label}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: coveredBand.bg,
                                                                color: coveredBand.color,
                                                                fontWeight: 700,
                                                                textTransform: 'capitalize'
                                                            }}
                                                        />
                                                    </Box>
                                                    <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
                                                        <Box sx={{ position: 'relative', width: 220, height: 130 }}>
                                                            <svg
                                                                viewBox="0 0 200 120"
                                                                width="220"
                                                                height="130"
                                                                style={{ display: 'block' }}
                                                            >
                                                                <defs>
                                                                    <linearGradient id="coveredScoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                        <stop offset="0%" stopColor={theme.palette.error.main} />
                                                                        <stop offset="50%" stopColor={theme.palette.warning.main} />
                                                                        <stop offset="100%" stopColor={theme.palette.success.main} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <path
                                                                    d="M 20 100 A 80 80 0 0 1 180 100"
                                                                    stroke="url(#coveredScoreGradient)"
                                                                    strokeOpacity="0.35"
                                                                    strokeWidth="14"
                                                                    fill="none"
                                                                    strokeLinecap="round"
                                                                    pathLength="100"
                                                                />
                                                                <path
                                                                    d="M 20 100 A 80 80 0 0 1 180 100"
                                                                    stroke={totalScoreCompletedParams === null
                                                                        ? alpha(theme.palette.text.secondary, isDark ? 0.4 : 0.3)
                                                                        : coveredBand.color}
                                                                    strokeWidth="14"
                                                                    fill="none"
                                                                    strokeLinecap="round"
                                                                    pathLength="100"
                                                                    strokeDasharray={`${totalScoreCompletedParams !== null ? Math.round(totalScoreCompletedParams) : 0} 100`}
                                                                />
                                                            </svg>
                                                            <Box
                                                                sx={{
                                                                    position: 'absolute',
                                                                    left: '50%',
                                                                    top: '52%',
                                                                    transform: 'translate(-50%, -50%)',
                                                                    textAlign: 'center'
                                                                }}
                                                            >
                                                                <Typography variant="h4" sx={{ fontWeight: 700, color: coveredBand.color, lineHeight: 1 }}>
                                                                    {totalScoreCompletedParams !== null ? Math.round(totalScoreCompletedParams) : '--'}
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.3 }}>
                                                                    /100
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 1 }}>
                                                        {isHumanAI
                                                            ? 'AI-assessed holistic score across 4 interview dimensions'
                                                            : totalParamCount > 0
                                                                ? `Asked & answered only (${completedParamCount}/${totalParamCount} covered)`
                                                                : 'Coverage details will appear once scoring is completed.'}
                                                    </Typography>
                                                </CardContent>
                                            </Card>

                                            <Card
                                                sx={{
                                                    borderRadius: 3,
                                                    bgcolor: 'background.paper',
                                                    backdropFilter: 'blur(10px)',
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    boxShadow: 1,
                                                }}
                                            >
                                                <CardContent>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                        AI Recommendation
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.7 }}>
                                                        {aiFeedback}
                                                    </Typography>
                                                    {item?.notes && (
                                                        <Typography variant="caption" sx={{ mt: 1.2, display: 'block', color: 'text.secondary' }}>
                                                            Notes: {item.notes}
                                                        </Typography>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Box>

                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            <Card
                                                sx={{
                                                    borderRadius: 3,
                                                    bgcolor: 'background.paper',
                                                    backdropFilter: 'blur(10px)',
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    boxShadow: 1,
                                                }}
                                            >
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                                Overall Evaluation
                                                            </Typography>
                                                            {isHumanAI && (
                                                                <Chip
                                                                    label="Human+AI Holistic"
                                                                    size="small"
                                                                    sx={{
                                                                        bgcolor: alpha(theme.palette.info.main, isDark ? 0.2 : 0.12),
                                                                        color: theme.palette.info.main,
                                                                        fontWeight: 600,
                                                                        fontSize: '0.65rem',
                                                                    }}
                                                                />
                                                            )}
                                                        </Box>
                                                        <Chip
                                                            label={bandLabel}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: totalBand.bg,
                                                                color: totalBand.color,
                                                                fontWeight: 700,
                                                                textTransform: 'capitalize'
                                                            }}
                                                        />
                                                    </Box>
                                                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.7 }}>
                                                        {overallEvaluation || 'Overall evaluation will appear once the interview is scored.'}
                                                    </Typography>
                                                </CardContent>
                                            </Card>

                                            {!isHumanAI && <Card
                                                sx={{
                                                    borderRadius: 3,
                                                    bgcolor: 'background.paper',
                                                    backdropFilter: 'blur(10px)',
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    boxShadow: 1,
                                                }}
                                            >
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                            Parameter-wise Evaluation
                                                        </Typography>
                                                        <Chip
                                                            label={bandLabel}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: totalBand.bg,
                                                                color: totalBand.color,
                                                                fontWeight: 700,
                                                                textTransform: 'capitalize'
                                                            }}
                                                        />
                                                    </Box>
                                                    <Box sx={{ mt: 1.5 }}>
                                                        {parameterWise.length > 0 ? (
                                                            <Box
                                                                sx={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                                                    gap: 1.2
                                                                }}
                                                            >
                                                                {parameterWise.map((param, idx) => {
                                                                    const band = scoreBand(param.score);
                                                                    return (
                                                                        <Box
                                                                            key={`${param.name}_${idx}`}
                                                                            sx={{
                                                                                p: 1.4,
                                                                                borderRadius: 2,
                                                                                bgcolor: neutralCardShade,
                                                                                border: 1,
                                                                                borderColor: neutralCardBorder,
                                                                                minHeight: 72,
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                gap: 0.6
                                                                            }}
                                                                        >
                                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                                                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                                                                    {param.name}
                                                                                </Typography>
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                                                                        {typeof param.score === 'number' ? `${param.score}%` : '—'}
                                                                                    </Typography>
                                                                                    <Chip
                                                                                        label={band.label}
                                                                                        size="small"
                                                                                        sx={{ bgcolor: band.bg, color: band.color, fontWeight: 700 }}
                                                                                    />
                                                                                </Box>
                                                                            </Box>
                                                                            {param.reason && (
                                                                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.5 }}>
                                                                                    {param.reason}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    );
                                                                })}
                                                            </Box>
                                                        ) : (
                                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                                Parameter-wise evaluation will appear after scoring.
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </CardContent>
                                            </Card>}

                                        </Box>
                                    </Box>
                                )}

                                {/* INTERVIEWER FEEDBACK SECTION */}
                                {(item?.interviewerType === 'Human' || item?.interviewerType === 'Human+AI') && (() => {
                                    const currentUserId = authState?.user?._id || authState?.user?.id;
                                    const isAssignedInterviewer = currentUserId && (item.interviewers || []).some(
                                        uid => String(uid) === String(currentUserId)
                                    );
                                    const existingFeedback = item?.interviewerFeedback;
                                    const isInterviewer = authState?.user?.role === 'interviewer';
                                    const isAdmin = ['ultra_admin', 'client_admin', 'manager', 'recruiter'].includes(authState?.user?.role);

                                    // Show section to: assigned interviewer OR admin (to view submitted feedback)
                                    if (!isAssignedInterviewer && !isAdmin) return null;
                                    if (isAdmin && !existingFeedback) return null;

                                    const RECOMMENDATIONS = [
                                        'Strongly Recommend',
                                        'Recommend',
                                        'Neutral',
                                        'Not Recommend',
                                        'Strongly Not Recommend',
                                    ];

                                    const recColor = (r) => {
                                        if (!r) return theme.palette.text.secondary;
                                        if (r === 'Strongly Recommend') return theme.palette.success.dark;
                                        if (r === 'Recommend') return theme.palette.success.main;
                                        if (r === 'Neutral') return theme.palette.warning.dark;
                                        if (r === 'Not Recommend') return theme.palette.error.main;
                                        if (r === 'Strongly Not Recommend') return theme.palette.error.dark;
                                        return theme.palette.text.secondary;
                                    };

                                    const handleSubmit = async () => {
                                        // Validate: the currently visible tab must have data
                                        if (feedbackMode === 'general' && !feedbackForm.rating) {
                                            setFeedbackError('Please select a star rating.');
                                            return;
                                        }
                                        if (feedbackMode === 'parameter') {
                                            if (paramRows.length === 0) {
                                                setFeedbackError('Please add at least one parameter.');
                                                return;
                                            }
                                            if (paramRows.some(r => !r.skill.trim())) {
                                                setFeedbackError('Please fill in all skill names.');
                                                return;
                                            }
                                        }
                                        setFeedbackLoading(true);
                                        setFeedbackError('');
                                        try {
                                            // Always send both general fields AND parameterRatings so both are stored
                                            const validParamRatings = paramRows
                                                .filter(r => r.skill.trim())
                                                .map(r => ({ skill: r.skill, rating: r.rating, comment: r.comment }));
                                            const body = {
                                                ...feedbackForm,
                                                parameterRatings: validParamRatings,
                                            };
                                            const res = await fetchData(`/api/interviewschedules/${id}/feedback`, {
                                                method: 'PUT',
                                                body: JSON.stringify(body),
                                            });
                                            if (res?.item) {
                                                setItem(res.item);
                                                setFeedbackForm({ rating: 0, recommendation: '', strengths: '', improvements: '', overallComment: '' });
                                                setIsEditingFeedback(false);
                                            }
                                        } catch (err) {
                                            setFeedbackError(err?.message || 'Failed to submit feedback. Please try again.');
                                        } finally {
                                            setFeedbackLoading(false);
                                        }
                                    };

                                    const handleSaveTemplate = async () => {
                                        const skills = paramRows.map(r => r.skill.trim()).filter(Boolean);
                                        if (!skills.length) return;
                                        setParamTemplateSaving(true);
                                        try {
                                            await fetchData('/api/interviewschedules/interviewer-preference', {
                                                method: 'PUT',
                                                body: JSON.stringify({ parameters: skills }),
                                            });
                                            setParamTemplateSaved(true);
                                            setTimeout(() => setParamTemplateSaved(false), 3000);
                                        } catch {
                                            // silently fail
                                        } finally {
                                            setParamTemplateSaving(false);
                                        }
                                    };

                                    return (
                                        <>
                                            <Divider sx={{ my: 3 }} />
                                            <Box sx={{ mb: 3 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                    <RateReviewOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                        Interviewer Feedback
                                                    </Typography>
                                                    {existingFeedback?.submittedAt && (
                                                        <Chip
                                                            icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important' }} />}
                                                            label="Submitted"
                                                            size="small"
                                                            sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main', fontWeight: 600, ml: 0.5 }}
                                                        />
                                                    )}
                                                </Box>

                                                {/* Show submitted feedback (read-only for admin, editable-preview for interviewer) */}
                                                {existingFeedback?.submittedAt && !isEditingFeedback ? (
                                                    <Card sx={{ borderRadius: 2.5, border: 1, borderColor: alpha(theme.palette.success.main, isDark ? 0.3 : 0.2), bgcolor: alpha(theme.palette.success.main, isDark ? 0.06 : 0.03) }}>
                                                        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                                                            {/* General feedback section — only when general fields have data */}
                                                            {(existingFeedback.rating > 0 || existingFeedback.recommendation || existingFeedback.strengths || existingFeedback.improvements || existingFeedback.overallComment) && (
                                                                <Box sx={{ mb: existingFeedback.parameterRatings?.length > 0 ? 2.5 : 0 }}>
                                                                    {existingFeedback.parameterRatings?.length > 0 && (
                                                                        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.6, display: 'block', mb: 1 }}>
                                                                            General Feedback
                                                                        </Typography>
                                                                    )}
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                                                                        {existingFeedback.rating > 0 && (
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                                                                {[1, 2, 3, 4, 5].map(s => (
                                                                                    s <= existingFeedback.rating
                                                                                        ? <StarIcon key={s} sx={{ color: theme.palette.warning.main, fontSize: 22 }} />
                                                                                        : <StarBorderIcon key={s} sx={{ color: alpha(theme.palette.warning.main, 0.4), fontSize: 22 }} />
                                                                                ))}
                                                                                <Typography variant="body2" sx={{ fontWeight: 700, ml: 0.5 }}>
                                                                                    {existingFeedback.rating}/5
                                                                                </Typography>
                                                                            </Box>
                                                                        )}
                                                                        {existingFeedback.recommendation && (
                                                                            <Chip
                                                                                label={existingFeedback.recommendation}
                                                                                size="small"
                                                                                sx={{ bgcolor: alpha(recColor(existingFeedback.recommendation), isDark ? 0.2 : 0.12), color: recColor(existingFeedback.recommendation), fontWeight: 700 }}
                                                                            />
                                                                        )}
                                                                    </Box>
                                                                    <Box sx={{ display: 'grid', gridTemplateColumns: { sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                                                                        {existingFeedback.strengths && (
                                                                            <Box>
                                                                                <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                                                                    Strengths
                                                                                </Typography>
                                                                                <Typography variant="body2" sx={{ mt: 0.4, color: 'text.primary', lineHeight: 1.6 }}>
                                                                                    {existingFeedback.strengths}
                                                                                </Typography>
                                                                            </Box>
                                                                        )}
                                                                        {existingFeedback.improvements && (
                                                                            <Box>
                                                                                <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                                                                    Areas for Improvement
                                                                                </Typography>
                                                                                <Typography variant="body2" sx={{ mt: 0.4, color: 'text.primary', lineHeight: 1.6 }}>
                                                                                    {existingFeedback.improvements}
                                                                                </Typography>
                                                                            </Box>
                                                                        )}
                                                                    </Box>
                                                                    {existingFeedback.overallComment && (
                                                                        <Box sx={{ mt: 2 }}>
                                                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                                                                Overall Comment
                                                                            </Typography>
                                                                            <Typography variant="body2" sx={{ mt: 0.4, color: 'text.primary', lineHeight: 1.6 }}>
                                                                                {existingFeedback.overallComment}
                                                                            </Typography>
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            )}

                                                            {/* Divider between sections when both exist */}
                                                            {(existingFeedback.rating > 0 || existingFeedback.recommendation || existingFeedback.strengths || existingFeedback.improvements || existingFeedback.overallComment) && existingFeedback.parameterRatings?.length > 0 && (
                                                                <Divider sx={{ mb: 2 }} />
                                                            )}

                                                            {/* Parameter-wise ratings table — only when parameterRatings exist */}
                                                            {existingFeedback.parameterRatings?.length > 0 && (
                                                                <Box>
                                                                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.6, display: 'block', mb: 1 }}>
                                                                        Parameter-wise Ratings
                                                                    </Typography>
                                                                    <Table size="small">
                                                                        <TableHead>
                                                                            <TableRow>
                                                                                <TableCell sx={{ fontWeight: 700, pl: 0 }}>Skill</TableCell>
                                                                                <TableCell sx={{ fontWeight: 700 }}>Rating</TableCell>
                                                                                <TableCell sx={{ fontWeight: 700 }}>Comment</TableCell>
                                                                            </TableRow>
                                                                        </TableHead>
                                                                        <TableBody>
                                                                            {existingFeedback.parameterRatings.map((p, i) => (
                                                                                <TableRow key={i}>
                                                                                    <TableCell sx={{ pl: 0, fontWeight: 600 }}>{p.skill}</TableCell>
                                                                                    <TableCell>
                                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                                                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                                                s <= (p.rating || 0)
                                                                                                    ? <StarIcon key={s} sx={{ fontSize: 15, color: theme.palette.warning.main }} />
                                                                                                    : <StarBorderIcon key={s} sx={{ fontSize: 15, color: alpha(theme.palette.warning.main, 0.4) }} />
                                                                                            ))}
                                                                                            <Typography variant="caption" sx={{ ml: 0.4 }}>{p.rating || 0}/5</Typography>
                                                                                        </Box>
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ color: 'text.secondary' }}>{p.comment || '—'}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </Box>
                                                            )}

                                                            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.disabled' }}>
                                                                Submitted {new Date(existingFeedback.submittedAt).toLocaleString()}
                                                            </Typography>

                                                            {/* Allow re-submission by assigned interviewer */}
                                                            {isAssignedInterviewer && isInterviewer && (
                                                                <Box sx={{ mt: 2 }}>
                                                                    <MUIButton
                                                                        variant="outlined"
                                                                        size="small"
                                                                        onClick={() => {
                                                                            // Restore both forms so interviewer can switch modes freely
                                                                            setFeedbackForm({
                                                                                rating: existingFeedback.rating || 0,
                                                                                recommendation: existingFeedback.recommendation || '',
                                                                                strengths: existingFeedback.strengths || '',
                                                                                improvements: existingFeedback.improvements || '',
                                                                                overallComment: existingFeedback.overallComment || '',
                                                                            });
                                                                            if (existingFeedback.parameterRatings?.length > 0) {
                                                                                setParamRows(existingFeedback.parameterRatings.map((r, i) => ({ id: i + 1, skill: r.skill, rating: r.rating || 0, comment: r.comment || '' })));
                                                                                setFeedbackMode('parameter');
                                                                            } else {
                                                                                setFeedbackMode('general');
                                                                            }
                                                                            setIsEditingFeedback(true);
                                                                        }}
                                                                    >
                                                                        Edit Feedback
                                                                    </MUIButton>
                                                                </Box>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                ) : (isAssignedInterviewer || isEditingFeedback) ? (
                                                    /* Feedback form for assigned interviewer */
                                                    <Card sx={{ borderRadius: 2.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                                                        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                                                            {/* Mode toggle */}
                                                            <Box sx={{ mb: 2.5 }}>
                                                                <ToggleButtonGroup
                                                                    value={feedbackMode}
                                                                    exclusive
                                                                    onChange={(_, val) => { if (val) { setFeedbackMode(val); setFeedbackError(''); } }}
                                                                    size="small"
                                                                >
                                                                    <ToggleButton value="general" sx={{ textTransform: 'none', fontWeight: 600, px: 2 }}>
                                                                        General
                                                                    </ToggleButton>
                                                                    <ToggleButton value="parameter" sx={{ textTransform: 'none', fontWeight: 600, px: 2 }}>
                                                                        Parameter-wise Rating
                                                                    </ToggleButton>
                                                                </ToggleButtonGroup>
                                                            </Box>

                                                            {feedbackMode === 'general' ? (
                                                                <>
                                                                    {/* Star rating */}
                                                                    <Box sx={{ mb: 2.5 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.8, color: 'text.primary' }}>
                                                                            Rating <Typography component="span" sx={{ color: 'error.main' }}>*</Typography>
                                                                        </Typography>
                                                                        <Box sx={{ display: 'flex', gap: 0.4 }}>
                                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                                <IconButton
                                                                                    key={star}
                                                                                    size="small"
                                                                                    onClick={() => setFeedbackForm(f => ({ ...f, rating: star }))}
                                                                                    sx={{ p: 0.3 }}
                                                                                >
                                                                                    {star <= feedbackForm.rating
                                                                                        ? <StarIcon sx={{ color: theme.palette.warning.main, fontSize: 28 }} />
                                                                                        : <StarBorderIcon sx={{ color: alpha(theme.palette.warning.main, 0.45), fontSize: 28 }} />
                                                                                    }
                                                                                </IconButton>
                                                                            ))}
                                                                            {feedbackForm.rating > 0 && (
                                                                                <Typography variant="caption" sx={{ alignSelf: 'center', ml: 0.5, color: 'text.secondary', fontWeight: 600 }}>
                                                                                    {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][feedbackForm.rating]}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    </Box>

                                                                    {/* Recommendation */}
                                                                    <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                                                                        <InputLabel>Recommendation</InputLabel>
                                                                        <Select
                                                                            value={feedbackForm.recommendation}
                                                                            label="Recommendation"
                                                                            onChange={e => setFeedbackForm(f => ({ ...f, recommendation: e.target.value }))}
                                                                        >
                                                                            <MenuItem value=""><em>Select…</em></MenuItem>
                                                                            {RECOMMENDATIONS.map(r => (
                                                                                <MenuItem key={r} value={r}>
                                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: recColor(r) }} />
                                                                                        {r}
                                                                                    </Box>
                                                                                </MenuItem>
                                                                            ))}
                                                                        </Select>
                                                                    </FormControl>

                                                                    {/* Strengths & Improvements */}
                                                                    <Box sx={{ display: 'grid', gridTemplateColumns: { sm: 'repeat(2, 1fr)' }, gap: 2, mb: 2.5 }}>
                                                                        <TextField
                                                                            label="Strengths"
                                                                            multiline
                                                                            rows={3}
                                                                            size="small"
                                                                            placeholder="What did the candidate do well?"
                                                                            value={feedbackForm.strengths}
                                                                            onChange={e => setFeedbackForm(f => ({ ...f, strengths: e.target.value }))}
                                                                        />
                                                                        <TextField
                                                                            label="Areas for Improvement"
                                                                            multiline
                                                                            rows={3}
                                                                            size="small"
                                                                            placeholder="What could the candidate improve?"
                                                                            value={feedbackForm.improvements}
                                                                            onChange={e => setFeedbackForm(f => ({ ...f, improvements: e.target.value }))}
                                                                        />
                                                                    </Box>

                                                                    {/* Overall comment */}
                                                                    <TextField
                                                                        label="Overall Comment"
                                                                        multiline
                                                                        rows={3}
                                                                        size="small"
                                                                        fullWidth
                                                                        placeholder="Any additional notes about this candidate…"
                                                                        value={feedbackForm.overallComment}
                                                                        onChange={e => setFeedbackForm(f => ({ ...f, overallComment: e.target.value }))}
                                                                        sx={{ mb: 2.5 }}
                                                                    />
                                                                </>
                                                            ) : (
                                                                /* Parameter-wise rating table */
                                                                <Box sx={{ mb: 2.5 }}>
                                                                    <Table size="small">
                                                                        <TableHead>
                                                                            <TableRow>
                                                                                <TableCell sx={{ fontWeight: 700, pl: 0, width: '34%' }}>Skill / Parameter</TableCell>
                                                                                <TableCell sx={{ fontWeight: 700, width: '26%' }}>Rating</TableCell>
                                                                                <TableCell sx={{ fontWeight: 700 }}>Comment</TableCell>
                                                                                <TableCell sx={{ width: 40 }} />
                                                                            </TableRow>
                                                                        </TableHead>
                                                                        <TableBody>
                                                                            {paramRows.map((row) => (
                                                                                <TableRow key={row.id}>
                                                                                    <TableCell sx={{ pl: 0, verticalAlign: 'top', pt: 1.2 }}>
                                                                                        <TextField
                                                                                            size="small"
                                                                                            fullWidth
                                                                                            placeholder="e.g. React, Communication…"
                                                                                            value={row.skill}
                                                                                            onChange={e => setParamRows(prev => prev.map(r => r.id === row.id ? { ...r, skill: e.target.value } : r))}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                                                                                        <Box sx={{ display: 'flex', gap: 0.2 }}>
                                                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                                                <IconButton
                                                                                                    key={star}
                                                                                                    size="small"
                                                                                                    onClick={() => setParamRows(prev => prev.map(r => r.id === row.id ? { ...r, rating: star } : r))}
                                                                                                    sx={{ p: 0.2 }}
                                                                                                >
                                                                                                    {star <= row.rating
                                                                                                        ? <StarIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
                                                                                                        : <StarBorderIcon sx={{ fontSize: 20, color: alpha(theme.palette.warning.main, 0.4) }} />
                                                                                                    }
                                                                                                </IconButton>
                                                                                            ))}
                                                                                        </Box>
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ verticalAlign: 'top', pt: 1.2 }}>
                                                                                        <TextField
                                                                                            size="small"
                                                                                            fullWidth
                                                                                            placeholder="Optional comment…"
                                                                                            value={row.comment}
                                                                                            onChange={e => setParamRows(prev => prev.map(r => r.id === row.id ? { ...r, comment: e.target.value } : r))}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ verticalAlign: 'top', pt: 1 }}>
                                                                                        <Tooltip title="Remove row">
                                                                                            <IconButton
                                                                                                size="small"
                                                                                                onClick={() => setParamRows(prev => prev.filter(r => r.id !== row.id))}
                                                                                                disabled={paramRows.length === 1}
                                                                                            >
                                                                                                <DeleteOutlineIcon fontSize="small" sx={{ color: 'error.light' }} />
                                                                                            </IconButton>
                                                                                        </Tooltip>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>

                                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                                                                        <MUIButton
                                                                            variant="text"
                                                                            size="small"
                                                                            startIcon={<AddIcon />}
                                                                            onClick={() => setParamRows(prev => [...prev, { id: Date.now(), skill: '', rating: 0, comment: '' }])}
                                                                        >
                                                                            Add Parameter
                                                                        </MUIButton>
                                                                        <Tooltip title={paramTemplateSaved ? 'Saved!' : 'Save this skill list for all future feedback forms'}>
                                                                            <span>
                                                                                <MUIButton
                                                                                    variant="outlined"
                                                                                    size="small"
                                                                                    startIcon={<BookmarkBorderIcon />}
                                                                                    onClick={handleSaveTemplate}
                                                                                    disabled={paramTemplateSaving || paramRows.every(r => !r.skill.trim())}
                                                                                    sx={{ color: paramTemplateSaved ? 'success.main' : undefined, borderColor: paramTemplateSaved ? 'success.main' : undefined }}
                                                                                >
                                                                                    {paramTemplateSaved ? 'Saved for Future!' : paramTemplateSaving ? 'Saving…' : 'Set for Future Use'}
                                                                                </MUIButton>
                                                                            </span>
                                                                        </Tooltip>
                                                                    </Box>
                                                                </Box>
                                                            )}

                                                            {feedbackError && (
                                                                <Typography variant="body2" sx={{ color: 'error.main', mb: 1.5 }}>
                                                                    {feedbackError}
                                                                </Typography>
                                                            )}

                                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                                                {isEditingFeedback && (
                                                                    <MUIButton
                                                                        variant="outlined"
                                                                        onClick={() => { setIsEditingFeedback(false); setFeedbackError(''); }}
                                                                        disabled={feedbackLoading}
                                                                    >
                                                                        Cancel
                                                                    </MUIButton>
                                                                )}
                                                                <MUIButton
                                                                    variant="contained"
                                                                    onClick={handleSubmit}
                                                                    disabled={feedbackLoading}
                                                                >
                                                                    {feedbackLoading ? 'Submitting…' : 'Submit Feedback'}
                                                                </MUIButton>
                                                            </Box>
                                                        </CardContent>
                                                    </Card>
                                                ) : null}
                                            </Box>
                                        </>
                                    );
                                })()}

                                {/* TECHNICAL SCRIPT OR CODING PROBLEM */}
                                {item.roundType === "Coding" ? (
                                    /* CODING ROUND: Show Problem and Test Cases */
                                    <>
                                        <Divider sx={{ my: 3 }} />
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CodeIcon fontSize="small" />
                                                Coding Problem
                                            </Typography>
                                        </Box>

                                        {loadingProblems ? (
                                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                                <CircularProgress size={24} />
                                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>Loading problem...</Typography>
                                            </Box>
                                        ) : selectedProblem ? (
                                            <>
                                                <Card
                                                    sx={{
                                                        borderRadius: 3,
                                                        bgcolor: 'background.paper',
                                                        backdropFilter: 'blur(10px)',
                                                        border: 1,
                                                        borderColor: 'divider',
                                                        boxShadow: 1,
                                                    }}
                                                >
                                                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                                                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                                                            {selectedProblem.title}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                                            {selectedProblem.description}
                                                        </Typography>

                                                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 2 }}>
                                                            <Chip
                                                                label={`Level: ${selectedProblem.difficulty || item.codingConfig?.questionLevel || 'N/A'}`}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                                                                    color: 'primary.main',
                                                                    fontWeight: 600
                                                                }}
                                                            />
                                                            <Chip
                                                                label={`Time Limit: ${selectedProblem.timeLimit || 2000}ms`}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: alpha(theme.palette.info.main, isDark ? 0.2 : 0.12),
                                                                    color: theme.palette.info.main,
                                                                    fontWeight: 600
                                                                }}
                                                            />
                                                            <Chip
                                                                label={`Memory Limit: ${(selectedProblem.memoryLimit || 256000) / 1024}MB`}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
                                                                    color: theme.palette.success.main,
                                                                    fontWeight: 600
                                                                }}
                                                            />
                                                        </Box>

                                                        {selectedProblem.constraints && (
                                                            <Box sx={{ mt: 2 }}>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                                                                    Constraints
                                                                </Typography>
                                                                <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 0 }}>
                                                                    {(typeof selectedProblem.constraints === 'string'
                                                                        ? selectedProblem.constraints.split('\n')
                                                                        : selectedProblem.constraints
                                                                    ).map((c, i) => (
                                                                        <li key={i}>
                                                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                                                {c}
                                                                            </Typography>
                                                                        </li>
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                {shouldShowTestCaseCard && (
                                                    <Card
                                                        sx={{
                                                            mt: 2,
                                                            borderRadius: 3,
                                                            bgcolor: 'background.paper',
                                                            backdropFilter: 'blur(10px)',
                                                            border: 1,
                                                            borderColor: 'divider',
                                                            boxShadow: 1,
                                                        }}
                                                    >
                                                        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                                    Test Case Results
                                                                </Typography>
                                                                {/* <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{
                                                                        textTransform: 'none',
                                                                        borderRadius: 2
                                                                    }}
                                                                    disabled
                                                                >
                                                                    CSV
                                                                </Button> */}
                                                            </Box>
                                                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                                                {finalSubmissionLoading
                                                                    ? 'Loading latest test case results…'
                                                                    : (hasResultRows
                                                                        ? (testCaseStats && testCaseStats.passed === testCaseStats.total
                                                                            ? `The candidate successfully solved all ${testCaseStats.total} test cases.`
                                                                            : 'Test case results are listed below.')
                                                                        : (finalSubmission
                                                                            ? 'Sample test cases shown (detailed results not available).'
                                                                            : (testCaseRows.length > 0
                                                                                ? 'Sample test cases are listed below.'
                                                                                : 'Test case results will appear after the final submission.')))}
                                                            </Typography>

                                                            {testCaseRows.length > 0 ? (
                                                                <Box
                                                                    sx={{
                                                                        border: 1,
                                                                        borderColor: alpha(theme.palette.primary.main, isDark ? 0.3 : 0.18),
                                                                        borderRadius: 2,
                                                                        overflow: 'hidden'
                                                                    }}
                                                                >
                                                                    <Box
                                                                        sx={{
                                                                            display: 'grid',
                                                                            gridTemplateColumns: { xs: '1fr', md: '90px 1.4fr 1fr 1fr 90px 110px' },
                                                                            gap: 0,
                                                                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                                                                            px: 1.5,
                                                                            py: 1,
                                                                            borderBottom: 1,
                                                                            borderBottomColor: alpha(theme.palette.primary.main, isDark ? 0.3 : 0.18),
                                                                        }}
                                                                    >
                                                                        {['Test Case', 'Input', 'Expected Output', "Candidate's Output", 'Time', 'Result'].map((label) => (
                                                                            <Typography key={label} variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                                                {label}
                                                                            </Typography>
                                                                        ))}
                                                                    </Box>
                                                                    {testCaseRows.map((row, idx) => {
                                                                        const badge = hasResultRows ? getTestResultBadge(row) : (summaryResultBadge || getTestResultBadge(row));
                                                                        const testCaseIdRaw =
                                                                            row?.testCaseId?._id ??
                                                                            row?.testCaseId?.id ??
                                                                            row?.testCaseId ??
                                                                            row?.testCase?._id ??
                                                                            row?.testCase?.id ??
                                                                            row?.testCase ??
                                                                            row?.id ??
                                                                            row?._id ??
                                                                            null;
                                                                        let lookup = testCaseIdRaw ? testCaseById.get(String(testCaseIdRaw)) : null;
                                                                        if (!lookup) {
                                                                            const orderKey = String(row?.testCaseId?.order ?? row?.order ?? row?.index ?? (idx + 1));
                                                                            lookup = testCaseByOrder.get(orderKey);
                                                                        }
                                                                        const inputVal = resolveTestValue(
                                                                            lookup?.input ??
                                                                            lookup?.inputValue ??
                                                                            lookup?.inputs ??
                                                                            lookup?.args ??
                                                                            lookup?.stdin ??
                                                                            lookup?.testCaseInput,
                                                                            row?.testCaseId?.input ??
                                                                            row?.input ??
                                                                            row?.inputValue ??
                                                                            row?.inputs ??
                                                                            row?.args ??
                                                                            row?.stdin ??
                                                                            row?.testCaseInput
                                                                        );
                                                                        const expectedVal = resolveTestValue(
                                                                            lookup?.expectedOutput ??
                                                                            lookup?.expected ??
                                                                            lookup?.output ??
                                                                            lookup?.expectedValue,
                                                                            row?.testCaseId?.expectedOutput ??
                                                                            row?.testCaseId?.output ??
                                                                            row?.expectedOutput ??
                                                                            row?.expected ??
                                                                            row?.output ??
                                                                            row?.expectedValue
                                                                        );
                                                                        const actualVal = hasResultRows
                                                                            ? resolveTestValue(
                                                                                row?.output ??
                                                                                row?.stdout ??
                                                                                row?.candidateOutput ??
                                                                                row?.actualOutput ??
                                                                                row?.resultOutput ??
                                                                                row?.userOutput ??
                                                                                row?.message ??
                                                                                row?.error ??
                                                                                row?.stderr ??
                                                                                row?.result?.output ??
                                                                                row?.result?.stdout ??
                                                                                row?.result?.message ??
                                                                                row?.result?.error ??
                                                                                row?.result?.stderr ??
                                                                                row?.submissionOutput ??
                                                                                row?.outputValue,
                                                                                finalSubmission?.stdout ??
                                                                                finalSubmission?.output ??
                                                                                finalSubmission?.message ??
                                                                                finalSubmission?.compilerOutput ??
                                                                                finalSubmission?.stderr ??
                                                                                '—'
                                                                            )
                                                                            : '—';
                                                                        const timeRaw = hasResultRows ? (row?.time ?? row?.executionTime ?? row?.timeMs ?? row?.runtimeMs) : null;
                                                                        const timeMs = typeof timeRaw === 'number'
                                                                            ? (timeRaw < 50 ? Math.round(timeRaw * 1000) : Math.round(timeRaw))
                                                                            : null;
                                                                        return (
                                                                            <Box
                                                                                key={`tc_${idx}`}
                                                                                sx={{
                                                                                    display: 'grid',
                                                                                    gridTemplateColumns: { xs: '1fr', md: '90px 1.4fr 1fr 1fr 90px 110px' },
                                                                                    gap: 0,
                                                                                    px: 1.5,
                                                                                    py: 1.1,
                                                                                    borderBottom: idx === testCaseRows.length - 1 ? 'none' : '1px solid',
                                                                                    borderBottomColor: idx === testCaseRows.length - 1
                                                                                        ? 'transparent'
                                                                                        : alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12),
                                                                                    bgcolor: idx % 2 === 0 ? 'background.paper' : 'background.default'
                                                                                }}
                                                                            >
                                                                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                                                    CASE {row?.testCaseId?.order ?? lookup?.order ?? idx + 1}
                                                                                </Typography>
                                                                                <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>
                                                                                    {inputVal}
                                                                                </Typography>
                                                                                <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>
                                                                                    {expectedVal}
                                                                                </Typography>
                                                                                <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>
                                                                                    {actualVal}
                                                                                </Typography>
                                                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                                                    {timeMs !== null ? `${timeMs}ms` : '—'}
                                                                                </Typography>
                                                                                <Chip
                                                                                    label={badge.label}
                                                                                    size="small"
                                                                                    sx={{
                                                                                        bgcolor: badge.bg,
                                                                                        color: badge.color,
                                                                                        fontWeight: 700,
                                                                                        width: 'fit-content'
                                                                                    }}
                                                                                />
                                                                            </Box>
                                                                        );
                                                                    })}
                                                                </Box>
                                                            ) : null}
                                                        </CardContent>
                                                    </Card>
                                                )}
                                            </>
                                        ) : (
                                            <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                                                <Typography color="text.secondary">
                                                    No coding problem assigned to this interview.
                                                </Typography>
                                            </Box>
                                        )}

                                        {/* Final Submission Review */}
                                        <FinalCodeReview interviewId={id} candidateId={candidate?._id} showDetails={false} />

                                    </>
                                ) : (
                                    /* SPEAKING ROUND: Show Technical Script */
                                    item.technicalScript?.trim() && (
                                        <>
                                            <Divider sx={{ my: 3 }} />
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                    Interview Script
                                                </Typography>
                                            </Box>
                                            <Card
                                                sx={{
                                                    mt: 1.5,
                                                    borderRadius: 3,
                                                    bgcolor: 'background.paper',
                                                    backdropFilter: 'blur(10px)',
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    boxShadow: 1,
                                                }}
                                            >
                                                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                                                    <Box
                                                        sx={{
                                                            p: { xs: 2, md: 2.5 },
                                                            borderRadius: 2,
                                                            bgcolor: 'background.default',
                                                            border: 1,
                                                            borderColor: 'divider',
                                                            color: 'text.secondary',
                                                            fontSize: 14,
                                                            lineHeight: 1.8,
                                                            maxHeight: 360,
                                                            overflow: 'auto',
                                                            whiteSpace: 'pre-wrap',
                                                            '&::-webkit-scrollbar': { width: 6 },
                                                            '&::-webkit-scrollbar-thumb': {
                                                                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.4 : 0.3),
                                                                borderRadius: 8
                                                            },
                                                            '&::-webkit-scrollbar-track': {
                                                                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)
                                                            }
                                                        }}
                                                    >
                                                        {item.technicalScript}
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </>
                                    )
                                )}
                            </CardContent>

                            {/* TRANSCRIPT MODAL (layout polished only) */}
                            <MUIModal
                                open={transcriptModalOpen}
                                onClose={() => setTranscriptModalOpen(false)}
                                contentSx={{
                                    maxWidth: 800,
                                    width: "90vw",
                                    borderRadius: 2,
                                    p: 3,
                                }}
                            >
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                    Interview Transcript
                                </Typography>

                                {candidate && (
                                    <Typography variant="subtitle2">
                                        Candidate: {`${candidate.firstName || ""} ${candidate.lastName || ""}`.trim()}
                                    </Typography>
                                )}
                                {job && (
                                    <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                        Job: {job.title}
                                    </Typography>
                                )}

                                <Divider sx={{ mb: 2 }} />

                                {transcriptLoading ? (
                                    <Box sx={{ textAlign: "center", py: 3 }}>
                                        <CircularProgress size={28} />
                                    </Box>
                                ) : !transcript?.messages?.length ? (
                                    <Typography>No transcript found.</Typography>
                                ) : (
                                    <Box
                                        sx={{
                                            maxHeight: "60vh",
                                            overflowY: "auto",
                                            pr: 1,
                                        }}
                                    >
                                        {transcript.messages.map((msg, i) => {
                                            const { name, text } = parseMessageContent(msg.content);
                                            const speaker = getSpeakerLabel(msg.role, name);
                                            if (!text) return null;

                                            const isCandidate = speaker === "Candidate";

                                            return (
                                                <Box key={i} sx={{ mb: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {speaker}
                                                    </Typography>

                                                    <Box
                                                        sx={(theme) => ({
                                                            mt: 0.5,
                                                            px: 1.8,
                                                            py: 1.2,
                                                            borderRadius: 2,
                                                            maxWidth: "100%",
                                                            fontSize: 13,
                                                            whiteSpace: "pre-wrap",
                                                            wordBreak: "break-word",
                                                            bgcolor: isCandidate
                                                                ? alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)
                                                                : theme.palette.primary.main,
                                                            color: isCandidate
                                                                ? theme.palette.text.primary
                                                                : theme.palette.primary.contrastText,
                                                            border: isCandidate
                                                                ? `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.35 : 0.2)}`
                                                                : "none",
                                                        })}
                                                    >
                                                        {text}
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                )}

                                <Box sx={{ textAlign: "right", mt: 2 }}>
                                    <MUIButton
                                        sx={{ textTransform: "none", borderRadius: 2, fontWeight: 600 }}
                                        onClick={() => setTranscriptModalOpen(false)}
                                    >
                                        Close
                                    </MUIButton>
                                </Box>
                            </MUIModal>

                            {/* Chat History Modal */}
                            <MUIModal
                                open={chatModalOpen}
                                onClose={() => setChatModalOpen(false)}
                                contentSx={{
                                    maxWidth: 800,
                                    width: "90vw",
                                    borderRadius: 2,
                                    p: 3,
                                }}
                            >
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                    Interview Chat History
                                </Typography>

                                {candidate && (
                                    <Typography variant="subtitle2">
                                        Candidate: {`${candidate.firstName || ""} ${candidate.lastName || ""}`.trim()}
                                    </Typography>
                                )}
                                {job && (
                                    <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                        Job: {job.title}
                                    </Typography>
                                )}

                                <Divider sx={{ mb: 2 }} />

                                {chatLoading ? (
                                    <Box sx={{ textAlign: "center", py: 3 }}>
                                        <CircularProgress size={28} />
                                    </Box>
                                ) : !chatHistory?.messages?.length ? (
                                    <Typography color="text.secondary">No chat messages found for this interview.</Typography>
                                ) : (
                                    <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }}>
                                        {chatHistory.messages.map((msg, i) => {
                                            const isInterviewer = msg.senderRole === "interviewer";
                                            const senderLabel = isInterviewer
                                                ? `Interviewer${msg.senderName ? ` (${msg.senderName})` : ""}`
                                                : `Candidate${msg.senderName ? ` (${msg.senderName})` : ""}`;
                                            const sentTime = msg.sentAt
                                                ? new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                : "";

                                            return (
                                                <Box key={i} sx={{ mb: 2 }}>
                                                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                            {senderLabel}
                                                        </Typography>
                                                        {sentTime && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {sentTime}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <Box
                                                        sx={(theme) => ({
                                                            px: 1.8,
                                                            py: 1.2,
                                                            borderRadius: 2,
                                                            fontSize: 13,
                                                            whiteSpace: "pre-wrap",
                                                            wordBreak: "break-word",
                                                            bgcolor: isInterviewer
                                                                ? theme.palette.primary.main
                                                                : alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                                                            color: isInterviewer
                                                                ? theme.palette.primary.contrastText
                                                                : theme.palette.text.primary,
                                                            border: isInterviewer
                                                                ? "none"
                                                                : `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.35 : 0.2)}`,
                                                        })}
                                                    >
                                                        {msg.kind === "file" ? (
                                                            <Box>
                                                                {msg.text && <Typography sx={{ fontSize: 13, mb: 0.5 }}>{msg.text}</Typography>}
                                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                                                                    <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                                                                        📎 {msg.file?.name || "Document"}
                                                                    </Typography>
                                                                    {msg.file?.size > 0 && (
                                                                        <Typography sx={{ fontSize: 11, opacity: 0.7 }}>
                                                                            ({msg.file.size >= 1024 * 1024
                                                                                ? `${(msg.file.size / (1024 * 1024)).toFixed(1)} MB`
                                                                                : `${Math.max(1, Math.round(msg.file.size / 1024))} KB`})
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            </Box>
                                                        ) : (
                                                            msg.text || ""
                                                        )}
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                )}

                                <Box sx={{ textAlign: "right", mt: 2 }}>
                                    <MUIButton
                                        sx={{ textTransform: "none", borderRadius: 2, fontWeight: 600 }}
                                        onClick={() => setChatModalOpen(false)}
                                    >
                                        Close
                                    </MUIButton>
                                </Box>
                            </MUIModal>
                        </Box>

                    </CardContent>
                </Card>

                <MUIModal
                    open={activationModalOpen}
                    onClose={() => setActivationModalOpen(false)}
                    contentSx={{ maxWidth: 420, width: '90vw' }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        Activate Interview Link
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        Set the interview start date &amp; time, then choose how long the link stays active.
                    </Typography>

                    {/* Custom start date/time */}
                    <TextField
                        label="Interview Start Date & Time"
                        type="datetime-local"
                        fullWidth
                        size="small"
                        value={activationStartAt}
                        onChange={(e) => setActivationStartAt(e.target.value)}
                        inputProps={{ min: (() => { const d = new Date(); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })() }}
                        sx={{ mb: 2.5 }}
                        InputLabelProps={{ shrink: true }}
                    />

                    {/* Link validity window */}
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                        Link valid for (after start time):
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        {[24, 48, 72].map((hours) => (
                            <Button
                                key={hours}
                                variant={activationHours === hours ? 'contained' : 'outlined'}
                                onClick={() => setActivationHours(hours)}
                                sx={{
                                    flex: 1,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderRadius: 2,
                                    bgcolor: activationHours === hours ? 'primary.main' : undefined,
                                    '&:hover': {
                                        bgcolor: activationHours === hours ? 'primary.dark' : undefined
                                    }
                                }}
                            >
                                {hours}h
                            </Button>
                        ))}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
                        <MUIButton
                            variant="outlined"
                            onClick={() => setActivationModalOpen(false)}
                            disabled={linkActionLoading}
                        >
                            Cancel
                        </MUIButton>
                        <MUIButton
                            variant="contained"
                            onClick={async () => {
                                await handleActivateAndReshare(activationHours);
                                setActivationModalOpen(false);
                            }}
                            disabled={linkActionLoading}
                        >
                            {linkActionLoading ? 'Activating...' : 'Activate & Reshare'}
                        </MUIButton>
                    </Box>
                </MUIModal>
                <Menu
                    anchorEl={scoreMenuAnchorEl}
                    open={scoreMenuOpen}
                    onClose={handleCloseScoreMenu}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem onClick={handleViewAllParameterScores}>
                        See All Parameter Scores
                    </MenuItem>
                    <MenuItem
                        onClick={handleOpenRegenerateFromMenu}
                        disabled={regenEvalLoading}
                    >
                        Regenerate Evaluation
                    </MenuItem>
                </Menu>
                <MUIModal
                    open={allParamScoresOpen}
                    onClose={() => setAllParamScoresOpen(false)}
                    contentSx={{ maxWidth: 720, width: '92vw' }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        All Parameter Scores
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        Total across all parameters: {displayTotalScore !== null ? Math.round(displayTotalScore) : '--'}/100
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1.2, maxHeight: '55vh', overflowY: 'auto' }}>
                        {parameterWise.length > 0 ? (
                            parameterWise.map((param, idx) => {
                                const band = scoreBand(param.score);
                                return (
                                    <Box
                                        key={`all_param_score_${param.name}_${idx}`}
                                        sx={{
                                            p: 1.4,
                                            borderRadius: 2,
                                            bgcolor: neutralCardShade,
                                            border: 1,
                                            borderColor: neutralCardBorder,
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                                {param.name}
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                                    {typeof param.score === 'number' ? `${param.score}%` : '—'}
                                                </Typography>
                                                <Chip
                                                    label={band.label}
                                                    size="small"
                                                    sx={{ bgcolor: band.bg, color: band.color, fontWeight: 700 }}
                                                />
                                            </Box>
                                        </Box>
                                        {param.reason && (
                                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.5, mt: 0.6 }}>
                                                {param.reason}
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })
                        ) : (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Parameter-wise evaluation will appear after scoring.
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5 }}>
                        <MUIButton
                            variant="outlined"
                            onClick={() => setAllParamScoresOpen(false)}
                        >
                            Close
                        </MUIButton>
                    </Box>
                </MUIModal>
                <MUIModal
                    open={regenEvalOpen}
                    onClose={() => {
                        if (regenEvalLoading) return;
                        setRegenEvalOpen(false);
                        setRegenEvalError('');
                    }}
                    contentSx={{ maxWidth: 420, width: '90vw' }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        Regenerate Evaluation
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        This will recompute the evaluation for this interview. Continue?
                    </Typography>
                    {regenEvalError && (
                        <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>
                            {regenEvalError}
                        </Typography>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2 }}>
                        <MUIButton
                            variant="outlined"
                            onClick={() => {
                                if (regenEvalLoading) return;
                                setRegenEvalOpen(false);
                                setRegenEvalError('');
                            }}
                            disabled={regenEvalLoading}
                        >
                            Cancel
                        </MUIButton>
                        <MUIButton
                            variant="contained"
                            onClick={handleRegenerateEvaluation}
                            disabled={regenEvalLoading}
                        >
                            {regenEvalLoading ? 'Regenerating...' : 'Regenerate'}
                        </MUIButton>
                    </Box>
                </MUIModal>

                <MUIModal
                    open={readingPassageAudioOpen}
                    onClose={() => setReadingPassageAudioOpen(false)}
                    title="Reading Passage Audio"
                    maxWidth="sm"
                >
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Candidate read-aloud recording saved after the interview.
                        </Typography>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                border: 1,
                                borderColor: 'divider',
                                bgcolor: 'background.default',
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                                Passage
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                {readingPassageText}
                            </Typography>
                        </Box>
                        <Box>
                            <audio
                                controls
                                preload="metadata"
                                src={readingPassageAudioUrl}
                                style={{ width: '100%' }}
                            >
                                Your browser does not support audio playback.
                            </audio>
                        </Box>
                    </Box>
                </MUIModal>
            </Box>

            {/* InterviewPlayback full-screen overlay */}
            {playbackOpen && playbackManifest && (
                <Suspense fallback={null}>
                    <InterviewPlayback
                        manifest={playbackManifest}
                        interviewScheduleId={item._id}
                        onClose={() => {
                            setPlaybackOpen(false);
                            setPlaybackManifest(null);
                        }}
                    />
                </Suspense>
            )}
        </>
    );
}
