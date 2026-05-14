import { useCallback, useEffect, useRef, useState } from 'react';

const getPreferredVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return null;
    }

    const voices = window.speechSynthesis.getVoices();
    const indianVoices = voices.filter((voice) =>
        /en-in/i.test(voice.lang)
        || /(india|indian|heera|priya|swara|kajal|raveena|veena|aditi|ravi)/i.test(voice.name)
    );
    const preferredPatterns = [
        /natural/i,
        /female/i,
        /heera/i,
        /priya/i,
        /aditi/i,
        /swara/i,
        /aria/i,
        /jenny/i,
        /samantha/i
    ];

    const preferredIndianVoice = preferredPatterns
        .map((pattern) => indianVoices.find((voice) => /en/i.test(voice.lang) && pattern.test(voice.name)))
        .find(Boolean);

    if (preferredIndianVoice) {
        return preferredIndianVoice;
    }

    const genericIndianVoice = indianVoices.find((voice) => /en/i.test(voice.lang));
    if (genericIndianVoice) {
        return genericIndianVoice;
    }

    return preferredPatterns
        .map((pattern) => voices.find((voice) => /en/i.test(voice.lang) && pattern.test(voice.name)))
        .find(Boolean) || voices.find((voice) => /en/i.test(voice.lang)) || null;
};

const useHeroInterviewSpeech = ({
    active,
    interviewComplete,
    questionIndex,
    currentPrompt,
    currentQuestionId,
    slowMode,
    setCandidateStatus,
    setInterviewerStatus
}) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voicesReady, setVoicesReady] = useState(false);
    const spokenPromptKeyRef = useRef('');
    const utteranceRef = useRef(null);
    const retryTimerRef = useRef(null);

    const cancelSpeech = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            return;
        }

        window.speechSynthesis.cancel();
        utteranceRef.current = null;
        setIsSpeaking(false);
    };

    useEffect(() => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            return undefined;
        }

        const syncVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setVoicesReady(true);
            }
        };

        syncVoices();
        window.speechSynthesis.onvoiceschanged = syncVoices;

        return () => {
            if (window.speechSynthesis.onvoiceschanged === syncVoices) {
                window.speechSynthesis.onvoiceschanged = null;
            }
        };
    }, []);

    const speakText = useCallback(({
        text,
        promptKey,
        liveStatus,
        readyStatus,
        speakingCandidateStatus,
        idleCandidateStatus,
        force = false
    }) => {
        if (!active || typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
            return;
        }

        if (!voicesReady) {
            if (retryTimerRef.current) {
                window.clearTimeout(retryTimerRef.current);
            }
            retryTimerRef.current = window.setTimeout(() => {
                speakText({
                    text,
                    promptKey,
                    liveStatus,
                    readyStatus,
                    speakingCandidateStatus,
                    idleCandidateStatus,
                    force
                });
            }, 220);
            return;
        }

        if (!force && spokenPromptKeyRef.current === promptKey) {
            return;
        }

        spokenPromptKeyRef.current = promptKey;
        cancelSpeech();

        const utterance = new SpeechSynthesisUtterance(text);
        const preferredVoice = getPreferredVoice();
        if (preferredVoice) {
            utterance.voice = preferredVoice;
            utterance.lang = preferredVoice.lang || 'en-IN';
        }
        utterance.rate = slowMode ? 0.78 : 0.88;
        utterance.pitch = 0.94;
        utterance.volume = 1;
        utterance.onstart = () => {
            setIsSpeaking(true);
            setInterviewerStatus(liveStatus);
            setCandidateStatus(speakingCandidateStatus);
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            setInterviewerStatus(readyStatus);
            setCandidateStatus(idleCandidateStatus);
        };
        utterance.onerror = () => {
            setIsSpeaking(false);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [active, voicesReady, slowMode, setCandidateStatus, setInterviewerStatus]);

    const speakPrompt = useCallback(({ force = false } = {}) => {
        if (!currentPrompt) {
            return;
        }

        const promptKey = interviewComplete ? 'complete' : questionIndex === -1 ? 'greeting' : `question-${questionIndex}`;
        speakText({
            text: currentPrompt,
            promptKey,
            liveStatus: promptKey === 'complete' ? 'Summary live' : promptKey === 'greeting' ? 'Greeting live' : `${currentQuestionId} live`,
            readyStatus: promptKey === 'complete' ? 'Summary ready' : promptKey === 'greeting' ? 'Greeting complete' : `${currentQuestionId} ready`,
            speakingCandidateStatus: promptKey === 'complete' ? 'Interview ended' : promptKey === 'greeting' ? 'Listening to greeting' : 'Listening',
            idleCandidateStatus: promptKey === 'complete' ? 'Interview ended' : promptKey === 'greeting' ? 'Ready to begin' : 'Ready to answer',
            force
        });
    }, [currentPrompt, interviewComplete, questionIndex, currentQuestionId, speakText]);

    useEffect(() => {
        if (!active) {
            spokenPromptKeyRef.current = '';
            cancelSpeech();
            return;
        }

        spokenPromptKeyRef.current = '';
    }, [active]);

    useEffect(() => {
        if (!active) {
            return;
        }

        speakPrompt();
    }, [active, interviewComplete, questionIndex, currentPrompt, speakPrompt]);

    useEffect(() => () => cancelSpeech(), []);
    useEffect(() => () => {
        if (retryTimerRef.current) {
            window.clearTimeout(retryTimerRef.current);
        }
    }, []);

    return {
        isSpeaking,
        speakPrompt,
        speakText,
        cancelSpeech
    };
};

export default useHeroInterviewSpeech;
