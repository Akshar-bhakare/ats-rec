/* eslint-disable no-unused-vars */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, IconButton, Chip, Paper, Button, Accordion, AccordionSummary, AccordionDetails, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox, FormControlLabel, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Mic, MicOff, Videocam, VideocamOff, CallEnd, AccessTime, HelpOutline, SupportAgent, DragIndicator, CheckCircle, ExpandMore, Close } from '@mui/icons-material';
import assistantBot from '../../assets/assistantbot.gif';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeEditor from './CodeEditor';
import NotesSection from './NotesSection';

// Styles for the resizable layout
const DRAG_HANDLE_WIDTH = 8;
const MIN_COLUMN_WIDTH = 200;

function VideoFeed({ stream, isLocal, label }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <Paper elevation={4} sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4/3',
            bgcolor: (theme) => theme.palette.common.black,
            borderRadius: 2,
            overflow: 'hidden',
        }}>
            <video
                ref={videoRef}
                autoPlay
                muted={isLocal}
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isLocal ? 'scaleX(-1)' : 'none' }}
            />
            <Typography variant="caption" sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                color: (theme) => theme.palette.common.white,
                bgcolor: (theme) => alpha(theme.palette.common.black, 0.6),
                px: 1,
                py: 0.5,
                borderRadius: 1,
                backdropFilter: 'blur(4px)',
                fontWeight: 'bold'
            }}>
                {label}
            </Typography>
        </Paper>
    );
}

export default function CodingWebRTC({
    videoRef,
    remoteStreams = [],
    scriptMeta = {},
    isMicOn,
    toggleMic,
    isCameraOn,
    toggleCamera,
    endCall,
    localStream
}) {
    const { problem, testCases, interviewId, candidateName, jobTitle, companyName, durationMinutes = 45 } = scriptMeta;

    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const [selectedLanguage, setSelectedLanguage] = useState(null);

    // Resizable Layout State
    const containerRef = useRef(null);
    // Initial sizes aiming for: Left ~25%, Center ~55%, Right ~20%
    const [leftWidth, setLeftWidth] = useState(() => Math.max(300, window.innerWidth * 0.25));
    const [centerWidth, setCenterWidth] = useState(() => Math.max(500, window.innerWidth * 0.55));
    const [isDraggingLeft, setIsDraggingLeft] = useState(false);
    const [isDraggingRight, setIsDraggingRight] = useState(false);

    // Timer logic
    const safeDuration = Number(durationMinutes) || 45;
    const [timeLeft, setTimeLeft] = useState(safeDuration * 60);
    const [openSupportDialog, setOpenSupportDialog] = useState(false);

    useEffect(() => {
        const val = Number(durationMinutes);
        if (val && val > 0) {
            setTimeLeft(val * 60);
        }
    }, [durationMinutes]);

    useEffect(() => {
        const timerId = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerId);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerId);
    }, []);

    useEffect(() => {
        if (timeLeft === 0) {
            endCall(true);
        }
    }, [timeLeft, endCall]);

    const formatTime = (seconds) => {
        if (seconds < 0) seconds = 0;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getTimerColor = () => {
        if (timeLeft <= 60) return theme.palette.error.main;
        if (timeLeft <= 300) return theme.palette.warning.main;
        return theme.palette.success.main;
    };

    const getDifficultyStyles = (level) => {
        const normalized = String(level || '').toLowerCase();
        if (normalized === 'hard') {
            return {
                color: theme.palette.error.main,
                bg: alpha(theme.palette.error.main, isDarkMode ? 0.2 : 0.12)
            };
        }
        if (normalized === 'medium') {
            return {
                color: theme.palette.warning.main,
                bg: alpha(theme.palette.warning.main, isDarkMode ? 0.2 : 0.12)
            };
        }
        return {
            color: theme.palette.success.main,
            bg: alpha(theme.palette.success.main, isDarkMode ? 0.2 : 0.12)
        };
    };

    const difficultyStyles = getDifficultyStyles(problem?.difficulty);

    const languageChipLabel = (() => {
        if (selectedLanguage?.name) return selectedLanguage.name;
        const langs = Array.isArray(problem?.allowedLanguages) ? problem.allowedLanguages : [];
        if (!langs.length) return 'Python';
        const python = langs.find((lang) =>
            lang?.judge0Id === 71 || String(lang?.name || '').toLowerCase().includes('python')
        );
        return (python || langs[0])?.name || 'Python';
    })();

    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
            videoRef.current.play().catch(e => console.error("[CodingWebRTC] Play error:", e));
        }
    }, [localStream, videoRef]);

    // Resizing Handlers
    const startResizeLeft = useCallback((e) => {
        e.preventDefault();
        setIsDraggingLeft(true);
    }, []);

    const startResizeRight = useCallback((e) => {
        e.preventDefault();
        setIsDraggingRight(true);
    }, []);

    const stopResize = useCallback(() => {
        setIsDraggingLeft(false);
        setIsDraggingRight(false);
    }, []);

    const doResize = useCallback((e) => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();

        if (isDraggingLeft) {
            const newWidth = e.clientX - containerRect.left;
            if (newWidth > MIN_COLUMN_WIDTH && (containerRect.width - newWidth - centerWidth) > MIN_COLUMN_WIDTH) {
                setLeftWidth(newWidth);
            }
        }
        else if (isDraggingRight) {
            // Center width is distance from left handle to mouse
            // We know left handle is at `leftWidth`
            // Mouse is at `e.clientX` relative to viewport, so `e.clientX - containerRect.left` is pos in container
            // centerWidth = (current mouse pos) - leftWidth
            const mousePosInContainer = e.clientX - containerRect.left;
            const newCenterWidth = mousePosInContainer - leftWidth;

            if (newCenterWidth > MIN_COLUMN_WIDTH && (containerRect.width - leftWidth - newCenterWidth) > MIN_COLUMN_WIDTH) {
                setCenterWidth(newCenterWidth);
            }
        }
    }, [isDraggingLeft, isDraggingRight, leftWidth, centerWidth]);

    useEffect(() => {
        if (isDraggingLeft || isDraggingRight) {
            window.addEventListener('mousemove', doResize);
            window.addEventListener('mouseup', stopResize);
        } else {
            window.removeEventListener('mousemove', doResize);
            window.removeEventListener('mouseup', stopResize);
        }
        return () => {
            window.removeEventListener('mousemove', doResize);
            window.removeEventListener('mouseup', stopResize);
        };
    }, [isDraggingLeft, isDraggingRight, doResize, stopResize]);


    return (
        <Box
            sx={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.default',
                color: 'text.primary',
                overflow: 'hidden'
            }}
        >
            {/* Header / Nav Bar */}
            <Box sx={{
                height: '60px',
                px: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: 'background.paper',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid',
                borderColor: 'divider',
                color: 'text.primary'
            }}>
                {/* Center: Back (Mock) & Title */}
                {/* <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <Button
                        startIcon={<Box component="span" sx={{ fontSize: '1.2rem', transform: 'rotate(180deg)', display: 'inline-block' }}>➜</Box>}
                        sx={{ color: 'text.secondary', textTransform: 'none', minWidth: 'auto', p: 0.5 }}
                    >
                        Back
                    </Button>
                    <Box>
                        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.primary' }}>
                            {jobTitle || 'Full Stack Developer'} <Box component="span" sx={{ color: 'text.secondary', mx: 1 }}>--</Box> <Box component="span" sx={{ color: 'warning.main' }}>{companyName || 'SANDEX LTD.'}</Box>
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1 }}>Round: {durationMinutes}:00</Typography>
                    </Box>
                </Box> */}

                {/* Right: Status */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        <span style={{ color: theme.palette.success.main }}>●</span> Progress auto-saved
                    </Typography>
                </Box>
            </Box>

            {/* Main Resizable Content Area */}
            <Box ref={containerRef} sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden', p: 2, gap: 0 }}>

                {/* 1. LEFT COLUMN: Problem Statement */}
                <Box sx={{ width: leftWidth, display: 'flex', flexDirection: 'column', pr: 3, minWidth: MIN_COLUMN_WIDTH }}>
                    <Paper
                        elevation={0}
                        sx={{
                            flexGrow: 1,
                            bgcolor: 'transparent',
                            borderRadius: 0,
                            overflow: 'hidden',
                            pl: 5,
                            pr: 2,
                            pt: 1,
                            pb: 1,

                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2
                        }}
                    >
                        {problem ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2, overflow: 'auto', pr: 1 }}>

                                {/* Problem Description Accordion */}
                                <Accordion defaultExpanded sx={{
                                    bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.9 : 0.7),
                                    backdropFilter: 'blur(8px)',
                                    boxShadow: 'none',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: '12px !important',
                                    '&:before': { display: 'none' }
                                }}>
                                    <AccordionSummary expandIcon={<ExpandMore sx={{ color: 'action.active' }} />} sx={{ bgcolor: 'action.hover' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box component="span" sx={{ fontSize: '1.2rem' }}>📄</Box>
                                            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'text.primary' }}>Problem Statement</Typography>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="h5" fontWeight="800" gutterBottom sx={{ color: 'text.primary' }}>
                                                {problem.title}
                                            </Typography>

                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                                                <Chip
                                                    label={problem.difficulty || 'Medium'}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: 'bold',
                                                        bgcolor: difficultyStyles.bg,
                                                        color: difficultyStyles.color,
                                                        borderRadius: 1
                                                    }}
                                                />
                                                <Chip
                                                    label={languageChipLabel.toUpperCase()}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: 'bold',
                                                        bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
                                                        color: 'primary.main',
                                                        borderRadius: 1
                                                    }}
                                                />
                                            </Box>

                                            {/* Function Signature Display */}
                                            {problem.signature && problem.signature.functionName && (
                                                <Box sx={{
                                                    mb: 2,
                                                    p: 1.5,
                                                    bgcolor: (theme) => alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                                                    border: '1px solid',
                                                    borderColor: (theme) => alpha(theme.palette.success.main, 0.4),
                                                    borderRadius: 2
                                                }}>
                                                    <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                                        Function Signature:
                                                    </Typography>
                                                    <Box component="code" sx={{
                                                        display: 'block',
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.85rem',
                                                        color: 'text.primary',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        {problem.signature.returnType} {problem.signature.functionName}(
                                                        {problem.signature.params && problem.signature.params.map((param, idx) => (
                                                            <span key={idx}>
                                                                {param.type} {param.name}{idx < problem.signature.params.length - 1 ? ', ' : ''}
                                                            </span>
                                                        ))}
                                                        )
                                                    </Box>
                                                </Box>
                                            )}

                                            <Box sx={{
                                                color: 'text.secondary',
                                                fontSize: '0.95rem',
                                                lineHeight: 1.7,
                                                '& p': { mb: 2 },
                                                '& h1, & h2, & h3': { color: 'text.primary', fontWeight: 800, mt: 3, mb: 1.5 },
                                                '& code': { bgcolor: 'action.hover', px: 0.6, py: 0.2, borderRadius: 1, fontFamily: 'monospace', color: 'text.primary' },
                                                '& pre': { bgcolor: 'action.hover', p: 2, borderRadius: 2, overflowX: 'auto', mb: 2, border: '1px solid', borderColor: 'divider' }
                                            }}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {problem.description}
                                                </ReactMarkdown>
                                            </Box>
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>

                                {/* Details / Constraints Accordion */}
                                <Accordion defaultExpanded
                                    elevation={0}
                                    sx={{
                                        bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.9 : 0.7),
                                        backdropFilter: 'blur(8px)',
                                        borderRadius: '12px !important',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        '&:before': { display: 'none' },
                                        color: 'text.primary'
                                    }}
                                >
                                    <AccordionSummary expandIcon={<ExpandMore sx={{ color: 'action.active' }} />} sx={{ bgcolor: 'action.hover' }}>
                                        <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'text.primary' }}>Details & Constraints</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        {problem.constraints && (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="text.secondary">Input Format:</Typography>
                                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: 'text.secondary' }}>
                                                    {problem.constraints}
                                                </Typography>
                                            </Box>
                                        )}
                                    </AccordionDetails>
                                </Accordion>

                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'text.secondary' }}>
                                Loading problem...
                            </Box>
                        )}
                    </Paper>
                </Box>

                {/* Left Resizer */}
                <Box
                    onMouseDown={startResizeLeft}
                    sx={{
                        width: DRAG_HANDLE_WIDTH,
                        cursor: 'col-resize',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        '&:hover': { bgcolor: 'action.hover' }
                    }}
                >
                    <Box sx={{ width: 4, height: 40, bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.3 : 0.2), borderRadius: 2 }} />
                </Box>

                {/* 2. CENTER COLUMN: Notes + Editor */}
                <Box sx={{ width: centerWidth, display: 'flex', flexDirection: 'column', gap: 1, minWidth: MIN_COLUMN_WIDTH }}>
                    {/* Top: Notes */}
                    {/* <Box sx={{ flex: '0 0 25%', minHeight: 0 }}>
                        <NotesSection interviewId={interviewId} />
                    </Box> */}

                    {/* Bottom: CodeEditor */}
                    <Box sx={{ flex: 1, minHeight: 0, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
                        <CodeEditor
                            interviewId={interviewId}
                            problem={problem}
                            testCases={testCases}
                            endCall={endCall}
                            onLanguageChange={setSelectedLanguage}
                        />
                    </Box>
                </Box>

                {/* Right Resizer */}
                <Box
                    onMouseDown={startResizeRight}
                    sx={{
                        width: DRAG_HANDLE_WIDTH,
                        cursor: 'col-resize',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        '&:hover': { bgcolor: 'action.hover' }
                    }}
                >
                    <Box sx={{ width: 4, height: 40, bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.3 : 0.2), borderRadius: 2 }} />
                </Box>

                {/* 3. RIGHT COLUMN: Video & Info */}
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    p: 2,
                    minWidth: MIN_COLUMN_WIDTH,
                    overflowY: 'auto'
                }}>
                    {/* User Video */}
                    <Box sx={{ width: '100%', position: 'relative' }}>
                        <Paper elevation={4} sx={{
                            width: '100%',
                            aspectRatio: '4/3',
                            bgcolor: 'background.paper',
                            borderRadius: 2,
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <Box sx={{
                                position: 'absolute',
                                top: 10,
                                left: 10,
                                bgcolor: (theme) => alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.2 : 0.15),
                                color: 'success.main',
                                border: '1px solid',
                                borderColor: (theme) => alpha(theme.palette.success.main, 0.5),
                                px: 1.5,
                                py: 0.4,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                zIndex: 2
                            }}>
                                <CheckCircle sx={{ fontSize: 14 }} />
                                <Typography variant="caption" component="span" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                    {formatTime(timeLeft)}
                                </Typography>
                            </Box>
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                            />
                        </Paper>
                    </Box>

                    {/* Candidate Info */}
                    <Box>
                        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            {candidateName || 'Vaishnavi Sanjay Chintawar'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {jobTitle || 'Full Stack Developer'}
                        </Typography>
                    </Box>

                    {/* Interview Rules */}
                    <Paper sx={{
                        p: 2,
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider'
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.primary' }}>
                            <CheckCircle fontSize="small" sx={{ color: 'success.main' }} />
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'text.primary' }}>Live Interview Rules</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontWeight: 500 }}>
                                📹 Camera is mandatory
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontWeight: 500 }}>
                                🖱 Tab stays open
                            </Typography>
                        </Box>
                    </Paper>

                    {/* Need Help? Box */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <HelpOutline fontSize="small" sx={{ color: 'text.secondary' }} />
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'text.primary' }}>
                                Need Help?
                            </Typography>
                        </Box>

                        <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            onClick={() => setOpenSupportDialog(true)}
                            startIcon={<SupportAgent />}
                            sx={{
                                textTransform: 'none',
                                borderRadius: 2
                            }}
                        >
                            Contact Support
                        </Button>
                    </Paper>

                    {/* Contact Support Dialog */}
                    <Dialog
                        open={openSupportDialog}
                        onClose={() => setOpenSupportDialog(false)}
                        maxWidth="sm"
                        fullWidth
                        PaperProps={{
                            sx: {
                                borderRadius: 3,
                                bgcolor: 'background.paper',
                                backdropFilter: 'blur(16px)',
                                border: '1px solid',
                                borderColor: 'divider',
                                boxShadow: 24,
                                position: 'relative',
                                overflow: 'visible'
                            }
                        }}
                    >
                        <Box sx={{ p: 1 }}>
                            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                                <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>Contact Support</Typography>
                                <IconButton onClick={() => setOpenSupportDialog(false)} size="small" sx={{ color: 'text.secondary' }}>
                                    <Close fontSize="small" />
                                </IconButton>
                            </DialogTitle>

                            <DialogContent sx={{ pb: 1, overflow: 'visible' }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>

                                    <Box>
                                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>How can we assist you?</Typography>
                                        <TextField
                                            fullWidth
                                            placeholder="vaishnavi.chintawar@gmail.com"
                                            defaultValue="vaishnavi.chintawar@gmail.com"
                                            variant="outlined"
                                            size="small"
                                            InputProps={{
                                                sx: {
                                                    borderRadius: 1.5,
                                                    bgcolor: 'background.default',
                                                    color: 'text.primary',
                                                    '& fieldset': { border: '1px solid', borderColor: 'divider' },
                                                    '&:hover fieldset': { borderColor: 'text.secondary' },
                                                    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                                                    fontSize: '0.9rem'
                                                }
                                            }}
                                        />
                                    </Box>

                                    <Box>
                                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>Message</Typography>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={3}
                                            placeholder="Explain your issue or ask a question..."
                                            variant="outlined"
                                            InputProps={{
                                                sx: {
                                                    borderRadius: 2,
                                                    bgcolor: 'background.default',
                                                    color: 'text.primary',
                                                    '& fieldset': { border: '1px solid', borderColor: 'divider' },
                                                    '&:hover fieldset': { borderColor: 'text.secondary' },
                                                    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                                                    fontSize: '0.9rem'
                                                }
                                            }}
                                        />
                                    </Box>

                                    <FormControlLabel
                                        control={<Checkbox defaultChecked sx={{ color: 'primary.main', '&.Mui-checked': { color: 'primary.main' } }} />}
                                        label={
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Include screenshot of my current view?</Typography>
                                        }
                                    />

                                    {/* Bot and Button Container */}
                                    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', mt: 2, position: 'relative' }}>

                                        <Button
                                            onClick={() => setOpenSupportDialog(false)}
                                            sx={{ mr: 2, color: 'text.secondary', fontWeight: 600, textTransform: 'none' }}
                                        >
                                            Cancel
                                        </Button>

                                        <Button
                                            variant="contained"
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                borderRadius: 2,
                                                px: 4,
                                                py: 1.2,
                                                zIndex: 1000
                                            }}
                                        >
                                            Send Message
                                        </Button>

                                        {/* Animated Bot */}
                                        <Box
                                            component="img"
                                            src={assistantBot}
                                            alt="Assistant Bot"
                                            sx={{
                                                position: 'absolute',
                                                bottom: 10, // Moved above button
                                                right: -5, // Centered closer to button edge
                                                width: '120px',
                                                height: 'auto',
                                                pointerEvents: 'none',
                                                filter: (theme) => `drop-shadow(0px 8px 16px ${alpha(theme.palette.common.black, 0.18)})`,
                                                zIndex: 0 // Behind button 
                                            }}
                                        />
                                    </Box>

                                </Box>
                            </DialogContent>
                        </Box>
                    </Dialog>

                    {/* Tip/Agent */}
                    <Box sx={{
                        mt: 'auto',
                        p: 2,
                        bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.12),
                        borderRadius: 2,
                        display: 'flex',
                        gap: 2,
                        alignItems: 'flex-start'
                    }}>
                        <Box sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <span style={{ fontSize: '20px' }}>👨‍💻</span>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'primary.main', lineHeight: 1.4 }}>
                            Take your time, Interpret the problem correctly and test your solution before submitting.
                        </Typography>
                    </Box>

                </Box>
            </Box>
        </Box>
    );
}
