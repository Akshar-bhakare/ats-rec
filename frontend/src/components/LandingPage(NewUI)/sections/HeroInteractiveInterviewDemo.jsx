import { useEffect, useMemo, useRef, useState } from 'react';
import { MicRounded, PauseRounded, ReplayRounded, SlowMotionVideoRounded } from '@mui/icons-material';
import { Box, Typography, alpha } from '@mui/material';
import '../../../components/WebRTC.css';
import laylaAvatar from '../../../assets/layla-avatar.gif';
import defaultAvatar from '../../../assets/default_avatar.jpg';
import HeroInterviewPreview from './HeroInterviewPreview';
import useHeroInterviewCamera from './useHeroInterviewCamera';
import useHeroInterviewRecognition from './useHeroInterviewRecognition';
import useHeroInterviewSpeech from './useHeroInterviewSpeech';

const buildInterviewScript = (firstName, roleTitle) => {
    const candidateName = firstName || 'there';
    const jobTitle = roleTitle || 'HR Manager';

    return {
        greetingPrompt: `Hi ${candidateName}, welcome to this ${jobTitle} interview demo. I am Layla, your AI interviewer. When you are ready, click Start Answering and say, I am ready.`,
        closingPrompt: `Thank you ${candidateName}. The interview is complete, and we will get back to you soon.`,
        questions: [
            {
                id: 'Question 1',
                prompt: 'Tell me about one HR program you led that improved hiring, engagement, or retention.'
            },
            {
                id: 'Question 2',
                prompt: 'How do you resolve conflict between a hiring manager and the HR team when the process starts slowing down?'
            },
            {
                id: 'Question 3',
                prompt: 'How do you measure hiring quality and make sure new hires succeed after joining?'
            },
            {
                id: 'Question 4',
                prompt: 'If attrition rises in one department, what would you do in the first thirty days to diagnose the issue and stabilize the team?'
            },
            {
                id: 'Wrap-up',
                prompt: `Before we close, summarize your leadership style in this ${jobTitle} role and the culture you help teams build.`
            }
        ],
        answers: [
            'I led a manager enablement program across onboarding and feedback cycles, and it reduced ninety-day attrition while improving employee satisfaction in our quarterly survey.',
            'I start by aligning both sides on the hiring goal, clarify the blockers with data, and then create a shared plan with ownership, timelines, and weekly review points.',
            'I track time to productivity, retention, manager feedback, and performance signals, then use those trends to refine role calibration, interview training, and onboarding.',
            'I would review exit data, run listening sessions, audit manager practices, and identify whether the problem is leadership, workload, compensation, or role clarity.',
            'My style is calm, data-backed, and people-first. I build cultures where managers are accountable, employees feel heard, and hiring standards stay high without becoming rigid.'
        ]
    };
};

const buildInterviewContext = (demoSession) => {
    const interviewMeta = demoSession?.interviewMeta || {};

    return {
        jobTitle: demoSession?.jobTitle || 'HR Manager',
        companyName: interviewMeta.companyName || 'Hirex REC',
        location: interviewMeta.location || 'Pune, Maharashtra, India',
        compensation: interviewMeta.compensation || 'The compensation range for this role is 12 to 18 lakh per annum, depending on experience and alignment.',
        workMode: interviewMeta.workMode || 'This role follows a hybrid setup with three office days and two remote days.',
        department: interviewMeta.department || 'People and Talent',
        team: interviewMeta.team || 'You would work closely with business leaders, hiring managers, and the People Operations team.',
        jobSummary: interviewMeta.jobSummary || 'This role covers hiring coordination, employee engagement, policy rollout, stakeholder alignment, and people analytics.',
        benefits: interviewMeta.benefits || 'The role includes paid leave, medical insurance, and structured growth opportunities.'
    };
};

const detectJobQuestionTopic = (text) => {
    const normalized = text.trim().toLowerCase();
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    const looksLikeQuestion = Boolean(
        normalized &&
        (
            /\?$/.test(text.trim())
            || /^(what|where|who|when|how|can you|could you|would you|is there|do you|does the|tell me|please share|may i know|i want to know|i would like to know)/.test(normalized)
            || /\b(can you share|could you share|tell me about|let me know|may i know)\b/.test(normalized)
            || wordCount <= 6
        )
    );

    if (!looksLikeQuestion) {
        return null;
    }

    if (/\b(company|organization|organisation|employer|company name|which company)\b/.test(normalized)) {
        return 'company';
    }

    if (/\b(location|where|city|office|based|where is the office)\b/.test(normalized)) {
        return 'location';
    }

    if (/\b(compensation|salary|ctc|package|pay|budget)\b/.test(normalized)) {
        return 'compensation';
    }

    if (/\b(remote|hybrid|onsite|on-site|work mode|wfh|work from home)\b/.test(normalized)) {
        return 'workMode';
    }

    if (/\b(role|responsibilities|job description|expectations|scope|what would i be doing)\b/.test(normalized)) {
        return 'jobSummary';
    }

    if (/\b(team|manager|reporting|department|who will i report)\b/.test(normalized)) {
        return 'team';
    }

    if (/\b(benefits|perks|leave|insurance)\b/.test(normalized)) {
        return 'benefits';
    }

    return null;
};

const buildJobQuestionReply = (topic, interviewContext) => {
    switch (topic) {
    case 'company':
        return `This opportunity is with ${interviewContext.companyName}.`;
    case 'location':
        return `The role is based in ${interviewContext.location}.`;
    case 'compensation':
        return interviewContext.compensation;
    case 'workMode':
        return interviewContext.workMode;
    case 'jobSummary':
        return interviewContext.jobSummary;
    case 'team':
        return `${interviewContext.department} team context: ${interviewContext.team}`;
    case 'benefits':
        return interviewContext.benefits;
    default:
        return `I can help with the company, location, compensation, work mode, or role expectations for this ${interviewContext.jobTitle} opportunity.`;
    }
};

const createRootVars = (theme, isDark) => {
    const primary = theme.palette.primary.main;
    const primaryDark = theme.palette.primary.dark;
    const textPrimary = theme.palette.text.primary;
    const textMuted = theme.palette.text.secondary;
    const surface = theme.palette.background.paper;
    const surfaceMuted = theme.palette.background.default;
    const border = theme.palette.divider;
    const info = theme.palette.info.main;
    const success = theme.palette.success.main;
    const warning = theme.palette.warning.main;
    const error = theme.palette.error.main;
    const onPrimary = theme.palette.getContrastText(primary);
    const onSuccess = theme.palette.getContrastText(success);
    const shadowSoft = theme.shadows[2] || 'none';
    const shadowStrong = theme.shadows[4] || shadowSoft;

    return {
        '--webrtc-font': "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
        '--webrtc-surface': surface,
        '--webrtc-surface-muted': surfaceMuted,
        '--webrtc-panel': surface,
        '--webrtc-panel-border': border,
        '--webrtc-border': border,
        '--webrtc-accent': primary,
        '--webrtc-accent-strong': primaryDark,
        '--webrtc-accent-soft': alpha(primary, isDark ? 0.2 : 0.12),
        '--webrtc-accent-soft-strong': alpha(primary, isDark ? 0.35 : 0.2),
        '--webrtc-success': success,
        '--webrtc-success-soft': alpha(success, isDark ? 0.2 : 0.12),
        '--webrtc-warning': warning,
        '--webrtc-warning-soft': alpha(warning, isDark ? 0.2 : 0.12),
        '--webrtc-error': error,
        '--webrtc-error-soft': alpha(error, isDark ? 0.2 : 0.12),
        '--webrtc-info': info,
        '--webrtc-info-soft': alpha(info, isDark ? 0.2 : 0.12),
        '--webrtc-on-accent': onPrimary,
        '--webrtc-overlay': alpha(theme.palette.common.black, 0.6),
        '--webrtc-overlay-soft': alpha(theme.palette.common.black, 0.45),
        '--webrtc-overlay-light': alpha(theme.palette.common.black, 0.18),
        '--webrtc-disabled-bg': alpha(textMuted, isDark ? 0.3 : 0.2),
        '--webrtc-disabled-text': textMuted,
        '--webrtc-shadow-soft': shadowSoft,
        '--webrtc-shadow-strong': shadowStrong,
        '--webrtc-page-bg': 'transparent',
        '--webrtc-text-primary': textPrimary,
        '--webrtc-text-muted': textMuted,
        '--webrtc-topbar-bg': surface,
        '--webrtc-topbar-text': primary,
        '--webrtc-topbar-subtext': textMuted,
        '--webrtc-topbar-chip-bg': surface,
        '--webrtc-topbar-chip-text': primary,
        '--webrtc-topbar-chip-border': alpha(primary, 0.45),
        '--webrtc-topbar-timer-bg': surface,
        '--webrtc-topbar-border': alpha(primary, 0.35),
        '--webrtc-controls-bg': alpha(primary, isDark ? 0.12 : 0.06),
        '--webrtc-controls-border': alpha(primary, isDark ? 0.3 : 0.2),
        '--webrtc-controls-label': textPrimary,
        '--webrtc-recording-pill-bg': success,
        '--webrtc-recording-pill-text': onSuccess,
        '--webrtc-panel-padding': '16px',
        '--webrtc-panel-padding-tight': '12px',
        '--webrtc-panel-height': '440px',
        '--webrtc-panel-min-height': '420px',
        '--webrtc-avatar-size': '240px',
        '--webrtc-shell-width': '100%',
        '--webrtc-shell-max-width': '100%',
        '--webrtc-question-bg': surface,
        '--webrtc-question-border': border,
        '--webrtc-question-shadow': shadowSoft,
        '--webrtc-question-progress-bg': alpha(primary, isDark ? 0.2 : 0.12),
        '--webrtc-question-progress-fill': primary,
        '--webrtc-question-muted': textMuted,
        '--webrtc-avatar-status-bg': alpha(surface, isDark ? 0.8 : 0.9),
        '--webrtc-proctoring-bg': alpha(surface, isDark ? 0.88 : 0.95),
        '--webrtc-proctoring-border': border,
        '--webrtc-frame-border': `1px solid ${border}`,
        '--webrtc-remote-border': `1px solid ${border}`,
        '--webrtc-transcript-bg': surfaceMuted,
        '--webrtc-transcript-padding': '12px 14px',
        '--webrtc-transcript-max-height': '360px',
        '--webrtc-transcript-border': border,
        '--webrtc-transcript-empty': textMuted,
        '--webrtc-transcript-ai': textPrimary,
        '--webrtc-human-grid-padding': '12px',
        '--webrtc-human-note-bg': surfaceMuted,
        '--webrtc-human-note-border': border,
        '--webrtc-instructions-bg': alpha(surface, isDark ? 0.9 : 0.96),
        '--webrtc-instructions-padding': '14px 16px',
        '--webrtc-bottom-bar-bg': alpha(surface, isDark ? 0.92 : 0.98),
        '--webrtc-bottom-transcript-bg': surface,
        '--webrtc-avatar-bg': surface
    };
};

const INTERVIEW_DURATION_SECONDS = 300;

const HeroInteractiveInterviewDemo = ({ isDark, theme, showcaseTitle, demoSession, onInterviewEnd }) => {
    const active = Boolean(demoSession);
    const sessionKey = demoSession?.sessionKey || '';
    const candidateFirstName = demoSession?.leadForm?.firstName || 'Candidate';
    const interviewContext = useMemo(() => buildInterviewContext(demoSession), [demoSession]);
    const interviewScript = useMemo(() => buildInterviewScript(candidateFirstName, interviewContext.jobTitle), [candidateFirstName, interviewContext.jobTitle]);
    const [interviewStage, setInterviewStage] = useState('greeting');
    const [questionIndex, setQuestionIndex] = useState(-1);
    const [remainingSeconds, setRemainingSeconds] = useState(INTERVIEW_DURATION_SECONDS);
    const [isPaused, setIsPaused] = useState(false);
    const [slowMode, setSlowMode] = useState(false);
    const [interviewComplete, setInterviewComplete] = useState(false);
    const [candidateStatus, setCandidateStatus] = useState('Ready to begin');
    const [interviewerStatus, setInterviewerStatus] = useState('Standby');
    const [, setTranscriptLines] = useState([]);
    const [interactionNotice, setInteractionNotice] = useState('');
    const greetingStartedRef = useRef(false);
    const greetingAdvancedRef = useRef(false);
    const fallbackGreetingTimerRef = useRef(null);
    const resumePromptTimerRef = useRef(null);
    const greetingForceStartTimerRef = useRef(null);
    const currentQuestion = questionIndex >= 0 ? interviewScript.questions[questionIndex] : null;
    const currentPrompt = interviewComplete
        ? interviewScript.closingPrompt
        : interviewStage === 'greeting' || interviewStage === 'readiness'
            ? interviewScript.greetingPrompt
            : currentQuestion?.prompt || '';
    const currentLabel = interviewComplete
        ? 'Interview Complete'
        : interviewStage === 'greeting' || interviewStage === 'readiness'
            ? 'Greeting'
            : currentQuestion?.id || 'Question';

    const clearFallbackGreetingTimer = () => {
        if (fallbackGreetingTimerRef.current) {
            window.clearTimeout(fallbackGreetingTimerRef.current);
            fallbackGreetingTimerRef.current = null;
        }
    };

    const clearResumePromptTimer = () => {
        if (resumePromptTimerRef.current) {
            window.clearTimeout(resumePromptTimerRef.current);
            resumePromptTimerRef.current = null;
        }
    };

    const clearGreetingForceStartTimer = () => {
        if (greetingForceStartTimerRef.current) {
            window.clearTimeout(greetingForceStartTimerRef.current);
            greetingForceStartTimerRef.current = null;
        }
    };

    const queueQuestion = (nextQuestionIndex, leadingLines = []) => {
        const nextQuestion = interviewScript.questions[nextQuestionIndex];

        if (!nextQuestion) {
            return;
        }

        setInterviewStage('question');
        setQuestionIndex(nextQuestionIndex);
        setInteractionNotice('');
        setCandidateStatus('Question loading');
        setInterviewerStatus(`${nextQuestion.id} live`);
        setTranscriptLines((current) => [
            ...current,
            ...leadingLines,
            { speaker: 'Layla', role: 'AI interviewer', text: nextQuestion.prompt }
        ]);
    };

    const mediaActive = active && !interviewComplete;

    const { isSpeaking, speakPrompt, speakText, cancelSpeech } = useHeroInterviewSpeech({
        active: mediaActive && !isPaused,
        interviewComplete,
        questionIndex,
        currentPrompt,
        currentQuestionId: interviewStage === 'greeting' || interviewStage === 'readiness'
            ? 'Greeting'
            : (currentQuestion?.id || 'Question'),
        slowMode,
        setCandidateStatus,
        setInterviewerStatus
    });

    const moveToReadinessPhase = () => {
        setInterviewStage('readiness');
        setInteractionNotice('');
        setCandidateStatus('Ready to begin');
        setInterviewerStatus('Greeting complete');
    };

    const buildAnswerReview = (answerText) => {
        const normalized = answerText.trim();

        if (!normalized) {
            return 'I could not clearly capture your answer. Please click Start Answering and respond again.';
        }

        const words = normalized.split(/\s+/).filter(Boolean);
        const snippet = words.slice(0, 16).join(' ');
        return `Thank you. I heard you say: ${snippet}${words.length > 16 ? '...' : '.'}`;
    };

    const completeInterview = (feedbackText) => {
        clearFallbackGreetingTimer();
        clearResumePromptTimer();
        clearGreetingForceStartTimer();
        setInterviewComplete(true);
        setInteractionNotice('');
        setCandidateStatus('Interview ended');
        setInterviewerStatus('Summary ready');
        setTranscriptLines((current) => {
            const nextLines = [...current];

            if (feedbackText) {
                nextLines.push({ speaker: 'Layla', role: 'AI interviewer', text: feedbackText });
            }

            if (nextLines[nextLines.length - 1]?.text !== interviewScript.closingPrompt) {
                nextLines.push({ speaker: 'Layla', role: 'AI interviewer', text: interviewScript.closingPrompt });
            }

            return nextLines;
        });
    };

    const handleAnswerCaptured = (answerText) => {
        const normalizedAnswer = answerText.trim();
        const answerReview = buildAnswerReview(normalizedAnswer);
        const jobQuestionTopic = detectJobQuestionTopic(normalizedAnswer);

        if (jobQuestionTopic) {
            const recruiterReply = buildJobQuestionReply(jobQuestionTopic, interviewContext);
            const followUp = interviewStage === 'question'
                ? `Now let us continue. ${currentQuestion?.prompt || ''}`
                : 'When you are ready, click Start Answering and say, I am ready.';

            setInteractionNotice('');
            setCandidateStatus(interviewStage === 'question' ? 'Ready to answer' : 'Ready to begin');
            setInterviewerStatus(interviewStage === 'question' ? `${currentQuestion?.id || 'Question'} ready` : 'Greeting ready');
            setTranscriptLines((current) => [
                ...current,
                { speaker: candidateFirstName, role: 'Candidate', text: normalizedAnswer },
                { speaker: 'Layla', role: 'AI interviewer', text: recruiterReply },
                { speaker: 'Layla', role: 'AI interviewer', text: followUp }
            ]);
            speakText({
                text: `${recruiterReply} ${followUp}`,
                promptKey: `job-info-${jobQuestionTopic}-${questionIndex}-${Date.now()}`,
                liveStatus: interviewStage === 'question' ? `${currentQuestion?.id || 'Question'} live` : 'Greeting live',
                readyStatus: interviewStage === 'question' ? `${currentQuestion?.id || 'Question'} ready` : 'Greeting ready',
                speakingCandidateStatus: 'Listening',
                idleCandidateStatus: interviewStage === 'question' ? 'Ready to answer' : 'Ready to begin',
                force: true
            });
            return;
        }

        if (interviewStage !== 'question') {
            if (!normalizedAnswer || !/\bready\b/i.test(normalizedAnswer)) {
                const readinessFeedback = 'Please click Start Answering and say, I am ready, so I can begin Question 1.';
                setInteractionNotice(readinessFeedback);
                setCandidateStatus('Ready confirmation needed');
                setInterviewerStatus('Greeting ready');
                setTranscriptLines((current) => [
                    ...current,
                    ...(normalizedAnswer ? [{ speaker: candidateFirstName, role: 'Candidate', text: normalizedAnswer }] : []),
                    { speaker: 'Layla', role: 'AI interviewer', text: readinessFeedback }
                ]);
                speakText({
                    text: readinessFeedback,
                    promptKey: `ready-retry-${Date.now()}`,
                    liveStatus: 'Greeting live',
                    readyStatus: 'Greeting ready',
                    speakingCandidateStatus: 'Listening',
                    idleCandidateStatus: 'Ready to begin',
                    force: true
                });
                return;
            }

            setInteractionNotice('');
            queueQuestion(0, [
                { speaker: candidateFirstName, role: 'Candidate', text: normalizedAnswer },
                { speaker: 'Layla', role: 'AI interviewer', text: 'Great. Let us begin the interview.' }
            ]);
            speakText({
                text: `Great. Let us begin the interview. ${interviewScript.questions[0].prompt}`,
                promptKey: 'question-0',
                liveStatus: 'Question 1 live',
                readyStatus: 'Question 1 ready',
                speakingCandidateStatus: 'Listening',
                idleCandidateStatus: 'Ready to answer',
                force: true
            });
            return;
        }

        if (!normalizedAnswer) {
            setInteractionNotice(answerReview);
            setCandidateStatus('Answer needed');
            setInterviewerStatus(`${currentQuestion?.id || 'Question'} ready`);
            setTranscriptLines((current) => [
                ...current,
                { speaker: 'Layla', role: 'AI interviewer', text: answerReview }
            ]);
            speakText({
                text: `${answerReview} ${currentQuestion?.prompt || ''}`,
                promptKey: `retry-${questionIndex}-${Date.now()}`,
                liveStatus: `${currentQuestion?.id || 'Question'} live`,
                readyStatus: `${currentQuestion?.id || 'Question'} ready`,
                speakingCandidateStatus: 'Listening',
                idleCandidateStatus: 'Ready to answer',
                force: true
            });
            return;
        }

        const candidateAnswer = normalizedAnswer;
        const nextIndex = questionIndex + 1;

        setInteractionNotice('');

        if (nextIndex >= interviewScript.questions.length) {
            setTranscriptLines((current) => [
                ...current,
                { speaker: candidateFirstName, role: 'Candidate', text: candidateAnswer }
            ]);
            completeInterview(answerReview);
            speakText({
                text: `${answerReview} ${interviewScript.closingPrompt}`,
                promptKey: 'complete',
                liveStatus: 'Summary live',
                readyStatus: 'Summary ready',
                speakingCandidateStatus: 'Interview ended',
                idleCandidateStatus: 'Interview ended',
                force: true
            });
            return;
        }

        const nextQuestion = interviewScript.questions[nextIndex];
        queueQuestion(nextIndex, [
            { speaker: candidateFirstName, role: 'Candidate', text: candidateAnswer },
            { speaker: 'Layla', role: 'AI interviewer', text: answerReview }
        ]);
        speakText({
            text: `${answerReview} ${nextQuestion.prompt}`,
            promptKey: `question-${nextIndex}`,
            liveStatus: `${nextQuestion.id} live`,
            readyStatus: `${nextQuestion.id} ready`,
            speakingCandidateStatus: 'Listening',
            idleCandidateStatus: 'Ready to answer',
            force: true
        });
    };

    const {
        isSupported: recognitionSupported,
        isListening,
        recognitionError,
        startListening,
        stopListening,
        cancelListening,
        clearRecognitionFeedback
    } = useHeroInterviewRecognition({
        active: mediaActive && !isPaused,
        onAnswerCaptured: handleAnswerCaptured,
        setCandidateStatus,
        setInterviewerStatus
    });

    const { videoRef, hasCameraFeed, cameraStatus, cameraError, stopCamera } = useHeroInterviewCamera({ active: mediaActive });

    useEffect(() => {
        if (!active) {
            clearFallbackGreetingTimer();
            clearResumePromptTimer();
            greetingStartedRef.current = false;
            greetingAdvancedRef.current = false;
            setInterviewStage('greeting');
            setQuestionIndex(-1);
            setRemainingSeconds(INTERVIEW_DURATION_SECONDS);
            setIsPaused(false);
            setSlowMode(false);
            setInterviewComplete(false);
            setInteractionNotice('');
            setCandidateStatus('Ready to begin');
            setInterviewerStatus('Standby');
            setTranscriptLines([]);
            return;
        }

        clearFallbackGreetingTimer();
        clearResumePromptTimer();
        clearGreetingForceStartTimer();
        greetingStartedRef.current = false;
        greetingAdvancedRef.current = false;
        setInterviewStage('greeting');
        setQuestionIndex(-1);
        setRemainingSeconds(INTERVIEW_DURATION_SECONDS);
        setIsPaused(false);
        setSlowMode(false);
        setInterviewComplete(false);
        setInteractionNotice('');
        setCandidateStatus('Listening to greeting');
        setInterviewerStatus('Greeting live');
        setTranscriptLines([
            { speaker: 'Layla', role: 'AI interviewer', text: interviewScript.greetingPrompt }
        ]);
        clearRecognitionFeedback();
    }, [active, sessionKey, interviewScript.greetingPrompt, clearRecognitionFeedback]);

    useEffect(() => () => {
        clearFallbackGreetingTimer();
        clearResumePromptTimer();
        clearGreetingForceStartTimer();
    }, []);

    useEffect(() => {
        if (!active || isPaused || interviewComplete || interviewStage !== 'greeting') {
            clearGreetingForceStartTimer();
            return undefined;
        }

        clearGreetingForceStartTimer();
        greetingForceStartTimerRef.current = window.setTimeout(() => {
            speakPrompt({ force: true });
        }, 140);

        return () => clearGreetingForceStartTimer();
    }, [active, interviewComplete, interviewStage, isPaused, sessionKey, speakPrompt]);

    useEffect(() => {
        if (!active || isPaused || interviewComplete) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            setRemainingSeconds((current) => (current > 0 ? current - 1 : 0));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [active, isPaused, interviewComplete]);

    useEffect(() => {
        if (!active || interviewComplete || remainingSeconds !== 0) {
            return;
        }

        cancelSpeech();
        cancelListening();
        stopCamera();
        completeInterview('The interview time is complete. I am closing the interview and preparing your summary.');
        window.setTimeout(() => {
            onInterviewEnd?.();
        }, 180);
    }, [active, interviewComplete, remainingSeconds, cancelListening, cancelSpeech, stopCamera, onInterviewEnd]);

    useEffect(() => {
        if (!interviewComplete) {
            return;
        }

        cancelSpeech();
        cancelListening();
        stopCamera();
    }, [interviewComplete, cancelListening, cancelSpeech, stopCamera]);

    useEffect(() => {
        if (interviewStage === 'greeting' && isSpeaking) {
            greetingStartedRef.current = true;
        }
    }, [interviewStage, isSpeaking]);

    useEffect(() => {
        if (!active || isPaused || interviewComplete || interviewStage !== 'greeting' || greetingAdvancedRef.current) {
            clearFallbackGreetingTimer();
            return undefined;
        }

        if (isSpeaking) {
            clearFallbackGreetingTimer();
            return undefined;
        }

        if (greetingStartedRef.current) {
            greetingAdvancedRef.current = true;
            moveToReadinessPhase();
            clearFallbackGreetingTimer();
            return undefined;
        }

        clearFallbackGreetingTimer();
        fallbackGreetingTimerRef.current = window.setTimeout(() => {
            if (greetingAdvancedRef.current) {
                return;
            }

            greetingAdvancedRef.current = true;
            moveToReadinessPhase();
        }, 2600);

        return () => clearFallbackGreetingTimer();
    }, [active, isPaused, interviewComplete, interviewStage, isSpeaking]);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${secs}`;
    };

    const progressValue = interviewComplete
        ? 100
        : questionIndex === -1
            ? 10
            : 18 + (((questionIndex + 1) / interviewScript.questions.length) * 72);

    const handlePrimaryAction = () => {
        if (interviewComplete) {
            return;
        }

        clearRecognitionFeedback();
        setInteractionNotice('');

        if (isSpeaking) {
            cancelSpeech();
        }

        if (interviewStage === 'greeting') {
            greetingAdvancedRef.current = true;
            moveToReadinessPhase();
        }

        if (!recognitionSupported) {
            if (interviewStage === 'readiness') {
                handleAnswerCaptured('I am ready');
                return;
            }
            handleAnswerCaptured(interviewScript.answers[questionIndex] || '');
            return;
        }

        if (isListening) {
            stopListening();
            return;
        }

        startListening();
    };

    const handleRepeatQuestion = () => {
        if (interviewComplete || isListening) {
            return;
        }

        clearRecognitionFeedback();
        setInteractionNotice('');
        setInterviewerStatus(interviewStage === 'greeting'
            ? 'Greeting replayed'
            : interviewStage === 'readiness'
                ? 'Greeting replayed'
                : `${currentQuestion?.id || 'Question'} replayed`);
        speakPrompt({ force: true });
    };

    const handlePauseToggle = () => {
        clearFallbackGreetingTimer();
        clearResumePromptTimer();
        clearGreetingForceStartTimer();

        if (!isPaused) {
            cancelSpeech();
            cancelListening();
            setCandidateStatus('Interview paused');
            setInterviewerStatus('Paused');
        } else if (!interviewComplete) {
            setCandidateStatus(interviewStage === 'greeting' || interviewStage === 'readiness' ? 'Greeting resuming' : 'Question resuming');
            setInterviewerStatus(interviewStage === 'greeting' || interviewStage === 'readiness' ? 'Greeting replayed' : `${currentQuestion?.id || 'Question'} replayed`);
            resumePromptTimerRef.current = window.setTimeout(() => {
                speakPrompt({ force: true });
            }, 120);
        }

        setIsPaused((current) => !current);
    };

    const handleEndInterview = () => {
        clearFallbackGreetingTimer();
        clearResumePromptTimer();
        clearGreetingForceStartTimer();
        cancelSpeech();
        cancelListening();
        stopCamera();
        completeInterview();
        window.setTimeout(() => {
            onInterviewEnd?.();
        }, 180);
    };

    if (!demoSession) {
        return <HeroInterviewPreview isDark={isDark} theme={theme} showcaseTitle={showcaseTitle} />;
    }

    return (
        <Box
            className={`webrtc-root ${isDark ? 'webrtc-dark' : 'webrtc-light'} webrtc-ai webrtc-size-lg`}
            style={createRootVars(theme, isDark)}
            sx={{
                minHeight: 'auto',
                p: 0,
                bgcolor: 'transparent',
                '& .webrtc-shell': {
                    width: '100%',
                    maxWidth: '100%',
                    m: 0,
                    borderRadius: '20px',
                    '@media (max-width: 899px)': {
                        minHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                    }
                },
                '& .webrtc-ai-grid': {
                    gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 0.9fr)',
                    gridTemplateAreas: '"video question avatar"',
                    gap: { md: '16px' },
                    '@media (max-width: 899px)': {
                        gridTemplateColumns: '1fr 1fr',
                        gridTemplateAreas: '"video avatar" "question question"',
                        gap: '12px'
                    }
                },
                '& .webrtc-question-text': {
                    fontSize: '0.95rem',
                    lineHeight: 1.62,
                    fontWeight: 700,
                    maxWidth: 540,
                    '@media (max-width: 899px)': {
                        fontSize: '0.92rem'
                    }
                },
                '& .webrtc-panel--question': {
                    display: 'flex',
                    flexDirection: 'column !important',
                    minHeight: { xs: 440, md: 440 },
                    maxHeight: { md: 440 },
                    position: 'relative',
                    overflow: 'visible !important',
                    padding: '24px 20px',
                    '@media (max-width: 899px)': {
                        minHeight: 400
                    }
                },
                '& .webrtc-question-head': {
                    flex: '0 0 auto',
                    marginBottom: { xs: 1.5, md: 0.8 }
                },
                '& .webrtc-question-scroll': {
                    maxHeight: 110,
                    '@media (max-width: 899px)': {
                        maxHeight: 120
                    }
                },
                '& .webrtc-bottom-bar': {
                    display: 'none'
                },
                '& .webrtc-smart-proctoring': {
                    marginBottom: 0,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '12px',
                    '@media (max-width: 899px)': {
                        display: 'none'
                    }
                },
                '& .webrtc-smart-proctoring-right': {
                    width: 'auto',
                    display: 'block',
                    justifyContent: 'initial',
                    '@media (max-width: 899px)': {
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end'
                    }
                },
                '& .webrtc-preview-camera': {
                    position: 'relative',
                    display: 'grid',
                    placeItems: 'center',
                    background: isDark
                        ? 'linear-gradient(180deg, rgba(30,41,59,0.96) 0%, rgba(15,23,42,0.98) 100%)'
                        : 'linear-gradient(180deg, #eef5ff 0%, #dbe7f5 100%)'
                },
                '& .webrtc-preview-camera::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: isDark
                        ? 'radial-gradient(circle at 76% 16%, rgba(249,115,22,0.18), transparent 22%)'
                        : 'radial-gradient(circle at 76% 16%, rgba(249,115,22,0.12), transparent 22%)'
                },
                '& .webrtc-preview-camera-avatar': {
                    position: 'relative',
                    zIndex: 1,
                    width: '68%',
                    height: 'auto',
                    maxWidth: 240,
                    objectFit: 'contain',
                    opacity: 0.96,
                    filter: 'drop-shadow(0 16px 28px rgba(15, 23, 42, 0.12))',
                    '@media (max-width: 899px)': {
                        width: 'auto',
                        height: '130px'
                    }
                },
                '& .webrtc-preview-camera-video': {
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)'
                },
                '& .webrtc-video-label': {
                    zIndex: 2
                },
                '& .webrtc-panel--video, & .webrtc-panel--avatar': {
                    minHeight: 'var(--webrtc-panel-min-height)',
                    height: 'var(--webrtc-panel-height)',
                    '@media (max-width: 899px)': {
                        minHeight: '200px',
                        height: '200px'
                    }
                },
                '& .webrtc-panel--avatar': {
                    backgroundImage: 'none'
                },
                '& .webrtc-preview-layla': {
                    width: '100%',
                    height: 'auto',
                    maxWidth: 215,
                    objectFit: 'contain',
                    '@media (max-width: 899px)': {
                        width: 'auto',
                        height: '130px'
                    }
                },
                '& .webrtc-question-progress-bar': {
                    width: `${progressValue}%`
                },
                '& .webrtc-question-actions': {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginTop: 'auto',
                    pb: 1.5
                },
                '& .webrtc-question-quick-actions': {
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'nowrap',
                    justifyContent: 'center',
                    mb: 0.8,
                    '& > button': {
                        py: 0.65,
                        px: 1,
                        fontSize: '0.74rem',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        borderRadius: '999px',
                        fontWeight: 900,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            transform: 'translateY(-1px)',
                            background: alpha(theme.palette.primary.main, 0.08),
                            color: 'primary.main',
                            borderColor: theme.palette.primary.main
                        }
                    }
                },
                '& .webrtc-start-btn--question': {
                    height: '42px',
                    borderRadius: '11px',
                    fontSize: '0.88rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: theme.palette.primary.main,
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    maxWidth: '300px',
                    margin: '0 auto',
                    boxShadow: '0 6px 20px -8px rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                    textTransform: 'none',
                    '&:hover': {
                        filter: 'brightness(1.08)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 8px 25px -8px rgba(0, 0, 0, 0.25)'
                    },
                    '&:active': {
                        transform: 'translateY(1px)'
                    },
                    '&.webrtc-interview-stop-btn': {
                        background: '#ef4444 !important'
                    }
                },
                '& .webrtc-end-interview-btn': {
                    height: '34px',
                    borderRadius: '9px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: alpha('#ef4444', 0.08),
                    color: '#ef4444',
                    border: '1px solid currentColor',
                    cursor: 'pointer',
                    width: '100%',
                    maxWidth: '300px',
                    margin: '0 auto',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    '&:hover': {
                        background: alpha('#ef4444', 0.14),
                        transform: 'translateY(-1px)'
                    }
                }
            }}
        >
            {showcaseTitle && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 1.4, md: 1.7 } }}>
                    <Box
                        sx={{
                            px: 2.4,
                            py: 0.85,
                            borderRadius: 999,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                            bgcolor: alpha(theme.palette.primary.main, 0.08)
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: { xs: '0.95rem', md: '1rem' },
                                fontWeight: 900,
                                letterSpacing: '-0.01em',
                                color: 'text.primary'
                            }}
                        >
                            {showcaseTitle}
                        </Typography>
                    </Box>
                </Box>
            )}

            <div className="webrtc-shell">
                <div className="webrtc-ai-grid">
                    <div className="webrtc-panel webrtc-panel--video">
                        <div className="webrtc-video-frame webrtc-video-frame--full webrtc-preview-camera">
                            {hasCameraFeed ? (
                                <video ref={videoRef} muted playsInline autoPlay className="webrtc-preview-camera-video" />
                            ) : (
                                <Box component="img" src={defaultAvatar} alt="Candidate camera preview" className="webrtc-preview-camera-avatar" />
                            )}
                            <div className="webrtc-video-label">You</div>
                        </div>
                    </div>

                    <div className="webrtc-panel webrtc-panel--question">
                        <div className="webrtc-question-head">
                            <div className="webrtc-question-meta">
                                <span className="webrtc-question-label">{currentLabel}</span>
                                <span className={`webrtc-question-badge ${isSpeaking ? 'is-live' : ''}`}>
                                    {interviewComplete ? 'Summary ready' : isPaused ? 'Paused' : isListening ? 'Listening' : isSpeaking ? 'Layla live' : interviewStage === 'readiness' ? 'Say I am ready' : 'Ready when you are'}
                                </span>
                            </div>
                            <div className="webrtc-question-scroll">
                                <p className="webrtc-question-text">{currentPrompt}</p>
                            </div>
                        </div>

                        <div className={`webrtc-question-progress ${isSpeaking ? 'is-active' : ''}`}>
                            <span className="webrtc-question-progress-bar" />
                        </div>

                        <div className="webrtc-question-actions">
                            <div className="webrtc-question-quick-actions">
                                <button type="button" className="webrtc-transcript-btn webrtc-quick-btn" onClick={handleRepeatQuestion} disabled={interviewComplete || isListening}>
                                    <ReplayRounded className="webrtc-quick-btn-icon" />
                                    <span>Repeat</span>
                                </button>
                                <button type="button" className={`webrtc-transcript-btn webrtc-quick-btn ${isPaused ? 'is-active' : ''}`} onClick={handlePauseToggle} disabled={interviewComplete}>
                                    <PauseRounded className="webrtc-quick-btn-icon" />
                                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                                </button>
                                <button type="button" className={`webrtc-transcript-btn webrtc-quick-btn ${slowMode ? 'is-active' : ''}`} onClick={() => setSlowMode((current) => !current)} disabled={interviewComplete || isListening}>
                                    <SlowMotionVideoRounded className="webrtc-quick-btn-icon" />
                                    <span>{slowMode ? 'Normal' : 'Slow'}</span>
                                </button>
                            </div>

                            <button
                                type="button"
                                className={`webrtc-start-btn webrtc-start-btn--question ${isListening ? 'webrtc-interview-stop-btn' : ''} ${interviewComplete ? 'is-disabled' : ''}`}
                                onClick={handlePrimaryAction}
                                disabled={interviewComplete}
                            >
                                <MicRounded sx={{ fontSize: '1.1rem' }} />
                                <span>{isListening ? 'Stop Answering' : 'Start Answering'}</span>
                            </button>

                            <button 
                                type="button" 
                                className="webrtc-end-interview-btn" 
                                onClick={handleEndInterview}
                            >
                                End Interview
                            </button>

                            {recognitionError && (
                                <p className="webrtc-start-error">{recognitionError}</p>
                            )}

                            {!recognitionError && interactionNotice && (
                                <p className="webrtc-start-error">{interactionNotice}</p>
                            )}

                        </div>

                    </div>

                    <div className="webrtc-panel webrtc-panel--avatar">
                        <Box component="img" src={laylaAvatar} alt="AI interviewer" className="webrtc-preview-layla" />
                        <div className="webrtc-avatar-status">
                            <span className={`webrtc-avatar-dot ${isSpeaking ? 'is-speaking' : ''}`} />
                            {interviewerStatus}
                        </div>
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, mt: 1.1, fontSize: '0.86rem', color: 'text.secondary', textAlign: 'center', px: 2 }}>
                            {interviewContext.jobTitle} interview, greeting-led flow, and structured follow-ups with a real interview-style experience.
                        </Typography>
                    </div>
                </div>

                <div className="webrtc-smart-proctoring">
                    <div className="webrtc-smart-proctoring-left">
                        <div className="webrtc-smart-proctoring-title">
                            Smart Proctoring enabled
                        </div>
                        <div className="webrtc-smart-proctoring-text">
                            Camera, mic, and tab focus are monitored across this {interviewContext.jobTitle} interview demo.
                        </div>
                        <div className="webrtc-smart-proctoring-warning">
                            <strong>Candidate:</strong> {candidateFirstName} | <strong>Role:</strong> {interviewContext.jobTitle} | <strong>Timer:</strong> {formatTime(remainingSeconds)} | <strong>Camera:</strong> {cameraStatus}
                            {cameraError && (
                                <Typography sx={{ mt: 1, fontSize: '0.82rem', color: 'text.secondary' }}>
                                    {cameraError}
                                </Typography>
                            )}
                        </div>
                    </div>
                    <div className="webrtc-smart-proctoring-right">
                        <span className="webrtc-smart-proctoring-chip">
                            Interview flow
                        </span>
                    </div>
                </div>
            </div>
        </Box>
    );
};

export default HeroInteractiveInterviewDemo;
