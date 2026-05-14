import { useCallback, useEffect, useRef, useState } from 'react';

const getRecognitionConstructor = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const useHeroInterviewRecognition = ({
    active,
    onAnswerCaptured,
    setCandidateStatus,
    setInterviewerStatus
}) => {
    const [isSupported, setIsSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [recognitionError, setRecognitionError] = useState('');
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const mergedTranscriptRef = useRef('');
    const shouldSubmitRef = useRef(false);
    const onAnswerCapturedRef = useRef(onAnswerCaptured);

    useEffect(() => {
        onAnswerCapturedRef.current = onAnswerCaptured;
    }, [onAnswerCaptured]);

    const abortRecognition = useCallback((shouldResetListening = true) => {
        if (!recognitionRef.current) {
            return;
        }

        shouldSubmitRef.current = false;
        try {
            recognitionRef.current.abort();
        } catch {
            // Ignore browser abort errors in the demo hook.
        }
        if (shouldResetListening) {
            setIsListening(false);
        }
    }, []);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            setRecognitionError('Voice input works in Chrome-based browsers.');
            setCandidateStatus('Voice input unavailable');
            setInterviewerStatus('Question ready');
            return;
        }

        finalTranscriptRef.current = '';
        mergedTranscriptRef.current = '';
        shouldSubmitRef.current = false;
        setLiveTranscript('');
        setRecognitionError('');
        setCandidateStatus('Listening to your answer');
        setInterviewerStatus('Listening');

        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch {
            setRecognitionError('Microphone is already busy. Try again.');
            setCandidateStatus('Unable to start listening');
            setInterviewerStatus('Question ready');
        }
    }, [setCandidateStatus, setInterviewerStatus]);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current || !isListening) {
            return;
        }

        shouldSubmitRef.current = true;
        setCandidateStatus('Checking your answer');
        setInterviewerStatus('Reviewing answer');
        recognitionRef.current.stop();
    }, [isListening, setCandidateStatus, setInterviewerStatus]);

    useEffect(() => {
        const Recognition = getRecognitionConstructor();
        setIsSupported(Boolean(Recognition));

        if (!Recognition) {
            return undefined;
        }

        const recognition = new Recognition();
        recognition.lang = 'en-IN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            let finalText = '';
            let interimText = '';

            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const segment = event.results[index][0]?.transcript || '';
                if (event.results[index].isFinal) {
                    finalText += `${segment} `;
                } else {
                    interimText += `${segment} `;
                }
            }

            if (finalText) {
                finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalText}`.trim();
            }

            mergedTranscriptRef.current = `${finalTranscriptRef.current} ${interimText}`.trim();
            setLiveTranscript(mergedTranscriptRef.current);
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                setRecognitionError('No speech detected. Try again.');
                setCandidateStatus('No answer detected');
                setInterviewerStatus('Question ready');
            } else if (event.error === 'not-allowed') {
                setRecognitionError('Microphone permission is blocked for this browser.');
                setCandidateStatus('Microphone blocked');
                setInterviewerStatus('Question ready');
            } else {
                setRecognitionError('Voice recognition failed in this browser.');
                setCandidateStatus('Voice capture failed');
                setInterviewerStatus('Question ready');
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            const shouldSubmit = shouldSubmitRef.current;
            shouldSubmitRef.current = false;
            setIsListening(false);

            if (!shouldSubmit) {
                return;
            }

            const capturedTranscript = mergedTranscriptRef.current.trim();
            setLiveTranscript('');
            onAnswerCapturedRef.current(capturedTranscript);
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.onresult = null;
            recognition.onerror = null;
            recognition.onend = null;
            abortRecognition(false);
            recognitionRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (active) {
            return;
        }

        abortRecognition();
        setLiveTranscript('');
        setRecognitionError('');
    }, [active]);

    const clearRecognitionFeedback = useCallback(() => {
        setLiveTranscript('');
        setRecognitionError('');
    }, []);

    return {
        isSupported,
        isListening,
        liveTranscript,
        recognitionError,
        startListening,
        stopListening,
        cancelListening: abortRecognition,
        clearRecognitionFeedback
    };
};

export default useHeroInterviewRecognition;
