'use client';

import React, {
    useEffect,
    useRef,
    useState,
    createElement,
    useMemo,
    useCallback,
} from 'react';
import { gsap } from 'gsap';

const TextType = ({
    text,
    as: Component = 'div',
    typingSpeed = 50,
    initialDelay = 0,
    pauseDuration = 2000,
    deletingSpeed = 30,
    loop = true,
    className = '',
    showCursor = true,
    hideCursorWhileTyping = false,
    cursorCharacter = '|',
    cursorClassName = '',
    cursorBlinkDuration = 0.5,
    textColors = [],
    variableSpeed,
    onSentenceComplete,
    startOnVisible = false,
    reverseMode = false,
    ...props
}) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(!startOnVisible);
    const cursorRef = useRef(null);
    const containerRef = useRef(null);

    const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

    const getRandomSpeed = useCallback(() => {
        if (!variableSpeed) return typingSpeed;
        const { min, max } = variableSpeed;
        return Math.random() * (max - min) + min;
    }, [variableSpeed, typingSpeed]);

    const getCurrentTextColor = () =>
        textColors.length > 0
            ? textColors[currentTextIndex % textColors.length]
            : 'inherit';

    // Visibility observer
    useEffect(() => {
        if (!startOnVisible || !containerRef.current) return;
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) setIsVisible(true);
                });
            },
            { threshold: 0.1 }
        );
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [startOnVisible]);

    // Cursor blink
    useEffect(() => {
        if (showCursor && cursorRef.current) {
            gsap.set(cursorRef.current, { opacity: 1 });
            gsap.to(cursorRef.current, {
                opacity: 0,
                duration: cursorBlinkDuration,
                repeat: -1,
                yoyo: true,
                ease: 'power2.inOut',
            });
        }
    }, [showCursor, cursorBlinkDuration]);

    // Typing logic
    useEffect(() => {
        if (!isVisible) return;

        let timeout;
        const currentText = textArray[currentTextIndex];
        const processedText = reverseMode
            ? currentText.split('').reverse().join('')
            : currentText;

        const executeTypingAnimation = () => {
            if (isDeleting) {
                if (displayedText === '') {
                    setIsDeleting(false);
                    if (currentTextIndex === textArray.length - 1 && !loop) return;
                    if (onSentenceComplete)
                        onSentenceComplete(textArray[currentTextIndex], currentTextIndex);

                    setCurrentTextIndex(prev => (prev + 1) % textArray.length);
                    setCurrentCharIndex(0);
                    timeout = setTimeout(() => { }, pauseDuration);
                } else {
                    timeout = setTimeout(() => {
                        setDisplayedText(prev => prev.slice(0, -1));
                    }, deletingSpeed);
                }
            } else {
                if (currentCharIndex < processedText.length) {
                    timeout = setTimeout(() => {
                        setDisplayedText(prev => prev + processedText[currentCharIndex]);
                        setCurrentCharIndex(prev => prev + 1);
                    }, variableSpeed ? getRandomSpeed() : typingSpeed);
                } else if (textArray.length > 1) {
                    timeout = setTimeout(() => {
                        setIsDeleting(true);
                    }, pauseDuration);
                }
            }
        };

        if (currentCharIndex === 0 && !isDeleting && displayedText === '') {
            timeout = setTimeout(executeTypingAnimation, initialDelay);
        } else {
            executeTypingAnimation();
        }

        return () => clearTimeout(timeout);
    }, [
        currentCharIndex,
        displayedText,
        isDeleting,
        typingSpeed,
        deletingSpeed,
        pauseDuration,
        textArray,
        currentTextIndex,
        loop,
        initialDelay,
        isVisible,
        reverseMode,
        variableSpeed,
        onSentenceComplete,
    ]);

    const shouldHideCursor =
        hideCursorWhileTyping &&
        (currentCharIndex < textArray[currentTextIndex].length || isDeleting);

    // Correct styles — compact and adaptive
    const styles = {
        container: {
            // was: inline-flex + nowrap
            display: 'inline',          // behaves like normal text, allows wrapping
            whiteSpace: 'normal',       // wrapping enabled
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            // maxWidth: '100%',           // respects parent width
            verticalAlign: 'baseline',
        },
        cursor: {
            // marginLeft: '0em', // instead of 0.15em
            display: shouldHideCursor ? 'none' : 'inline-block',
            opacity: 1,
        }

    };

    return createElement(
        Component,
        {
            ref: containerRef,
            className: `text-type ${className}`,
            style: styles.container,
            ...props,
        },
        <>
            <span
                className="text-type__content"
                style={{ color: getCurrentTextColor() }}
            >
                {displayedText}
            </span>
            {showCursor && (
                <span
                    ref={cursorRef}
                    className={`text-type__cursor ${cursorClassName}`}
                    style={styles.cursor}
                >
                    {cursorCharacter}
                </span>
            )}
        </>
    );
};

export default TextType;
