/* eslint-disable no-empty */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Avatar, Badge, Box, Button, Chip, CircularProgress, Divider,
    IconButton, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { styled, keyframes, useTheme, alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardVoiceRoundedIcon from '@mui/icons-material/KeyboardVoiceRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { fetchData } from '../../AppUtils/dataAPI';

const supportsSTT = () =>
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

const recognizerFactory = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'en-IN';
    r.interimResults = true;
    r.continuous = true;
    return r;
};

const float = keyframes`
  0% { transform: translateY(0px) }
  50% { transform: translateY(-8px) }
  100% { transform: translateY(0px) }
`;
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(25,118,210,.35) }
  70% { box-shadow: 0 0 0 14px rgba(25,118,210,0) }
  100% { box-shadow: 0 0 0 0 rgba(25,118,210,0) }
`;

const FabShell = styled(Box)(({ theme }) => ({
    position: 'fixed', right: 24, bottom: 24, zIndex: theme.zIndex.modal + 2,
}));
const FabButton = styled(IconButton)(({ theme }) => ({
    width: 60, height: 60, borderRadius: '50%', color: theme.palette.text.primary,
    background: `radial-gradient(circle at 28% 22%, ${alpha(
        theme.palette.common.white,
        theme.palette.mode === 'dark' ? 0.2 : 0.9
    )} 0%, ${alpha(
        theme.palette.grey[300],
        theme.palette.mode === 'dark' ? 0.36 : 0.88
    )} 62%, ${alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.28 : 0.58)} 100%)`,
    border: `1px solid ${alpha(
        theme.palette.primary.main,
        theme.palette.mode === 'dark' ? 0.42 : 0.2
    )}`,
    boxShadow: theme.palette.mode === 'dark'
        ? '0 18px 36px rgba(0,0,0,.55)'
        : '0 18px 36px rgba(25,118,210,.35)',
    animation: `${float} 12s ease-in-out infinite`,
    '&:hover': {
        background: `radial-gradient(circle at 28% 22%, ${alpha(
            theme.palette.common.white,
            theme.palette.mode === 'dark' ? 0.24 : 0.94
        )} 0%, ${alpha(
            theme.palette.grey[300],
            theme.palette.mode === 'dark' ? 0.4 : 0.92
        )} 62%, ${alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.32 : 0.62)} 100%)`,
        borderColor: alpha(
            theme.palette.primary.main,
            theme.palette.mode === 'dark' ? 0.56 : 0.3
        ),
    },
}));
const GlowOrb = styled('div')({ position: 'absolute', pointerEvents: 'none', borderRadius: '50%', filter: 'blur(18px)' });
const Panel = styled(Paper)(({ theme }) => {
    const top = alpha(theme.palette.primary.main, 0.10);
    const mid = alpha(theme.palette.background.paper, 0.92);
    const bot = alpha(theme.palette.background.paper, 0.98);
    return {
        position: 'fixed', right: 24, bottom: 96, width: 420, maxWidth: 'calc(100vw - 32px)',
        height: 640, borderRadius: 22, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: `linear-gradient(180deg, ${top} 0%, ${mid} 28%, ${bot} 100%)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        boxShadow: theme.palette.mode === 'dark'
            ? '0 30px 70px rgba(0,0,0,.65)'
            : '0 30px 70px rgba(2,11,31,.22)',
        backdropFilter: 'blur(10px)',
        zIndex: theme.zIndex.modal + 2,
    };
});
const Header = styled(Box)(({ theme }) => ({
    padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.light, 0.12)} 100%)`,
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
}));
const ScrollArea = styled(Box)({ flex: 1, overflowY: 'auto', padding: '14px 16px' });

const Bubble = ({ role, children }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const assistantStyles = {
        bgcolor: alpha(theme.palette.background.paper, 0.90),
        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        boxShadow: isDark ? '0 10px 24px rgba(0,0,0,.55)' : '0 10px 24px rgba(2,11,31,.08)',
        color: theme.palette.text.primary,
        backgroundImage: `radial-gradient(circle at 0% 0%, ${alpha(theme.palette.primary.main, .06)}, transparent 35%)`,
    };
    const userStyles = {
        bgcolor: 'transparent', color: '#fff',
        backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
        boxShadow: isDark ? '0 14px 28px rgba(0,0,0,.55)' : '0 14px 28px rgba(25,118,210,.38)',
    };
    return (
        <Stack alignItems={role === 'assistant' ? 'flex-start' : 'flex-end'} sx={{ mb: 1.2 }}>
            <Box
                component={motion.div}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18 }}
                sx={{
                    px: 1.8, py: 1.25, borderRadius: 2.2, maxWidth: '88%', fontSize: 14.5,
                    lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    ...(role === 'assistant' ? assistantStyles : userStyles),
                }}
            >
                {children}
            </Box>
        </Stack>
    );
};

const AssistantWidget = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState(() => {
        const cached = localStorage.getItem('ai-assistant-messages');
        return cached ? JSON.parse(cached) : [{ role: 'assistant', content: 'Hi! How can I help you today?' }];
    });
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const [speaking, setSpeaking] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);

    const [listening, setListening] = useState(false);
    const recRef = useRef(null);

    const scrollRef = useRef(null);
    const wsRef = useRef(null);
    const [wsReady, setWsReady] = useState(false);

    const countForBadge = useMemo(() => (open ? 0 : Math.max(messages.length - 1, 0)), [messages.length, open]);

    useEffect(() => {
        localStorage.setItem('ai-assistant-messages', JSON.stringify(messages));
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, open]);

    useEffect(() => {
        if (!open) return;
        // establish WS (WSS if page is HTTPS)
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${window.location.host}/api/assistant/chat/ws`;
        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => setWsReady(true);
            ws.onclose = () => setWsReady(false);
            ws.onerror = () => setWsReady(false);

            ws.onmessage = (evt) => {
                let payload = {};
                try { payload = JSON.parse(evt.data); } catch { }
                const { event } = payload || {};

                if (event === 'message') {
                    const content = payload?.message?.content || 'Sorry, I missed that.';
                    setMessages(m => [...m, { role: 'assistant', content }]);

                    // play audio from base64 if present
                    if (speaking && payload?.audioBase64) {
                        playBase64(payload.audioBase64, payload.audioEncoding);
                    }
                } else if (event === 'redirect') {
                    const to = payload?.to || '/';
                    setMessages(m => [...m, { role: 'assistant', content: `Redirecting you to ${to}…` }]);
                    navigate(to);
                } else if (event === 'unauthorized') {
                    const content = payload?.message?.content || 'You are not signed in.';
                    setMessages(m => [...m, { role: 'assistant', content }]);
                    if (payload?.redirectTo) navigate(payload.redirectTo);
                } else if (event === 'error') {
                    setMessages(m => [...m, { role: 'assistant', content: payload?.error || 'I hit a snag. Please try again.' }]);
                }
            };

            return () => {
                try { ws.close(); } catch { }
            };
        } catch {
            setWsReady(false);
        }
    }, [open, navigate, speaking]);

    const revokeBlobUrl = (url) => {
        if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    };

    const cleanupAudioInstance = (audio) => {
        if (!audio) return;
        revokeBlobUrl(audio.src);
        if (audioRef.current === audio) {
            audioRef.current = null;
        }
    };

    // Voice helpers
    const playAudio = (url) => {
        stopAudio();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
            setIsPlaying(false);
            cleanupAudioInstance(audio);
        };
        audio.onerror = () => {
            setIsPlaying(false);
            cleanupAudioInstance(audio);
        };
        audio.play()
            .then(() => setIsPlaying(true))
            .catch(() => {
                setIsPlaying(false);
                cleanupAudioInstance(audio);
            });
    };
    const base64ToBlobUrl = (b64, mime = 'audio/mpeg') => {
        try {
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return URL.createObjectURL(new Blob([arr], { type: mime }));
        } catch {
            return null;
        }
    };
    const playBase64 = (b64, audioEncoding = 'MP3') => {
        const mime = String(audioEncoding).toUpperCase().includes('MP3') ? 'audio/mpeg' : 'audio/wav';
        const url = base64ToBlobUrl(b64, mime);
        if (url) playAudio(url);
    };
    const pauseAudio = () => { if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); } };
    const resumeAudio = () => { if (audioRef.current) { audioRef.current.play(); setIsPlaying(true); } };
    const stopAudio = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
        cleanupAudioInstance(audio);
        setIsPlaying(false);
    };

    // STT helpers
    const startListening = () => {
        if (!supportsSTT()) return;
        if (!recRef.current) recRef.current = recognizerFactory();
        if (!recRef.current) return;
        setListening(true);
        recRef.current.start();
        recRef.current.onresult = (e) => {
            let transcript = '';
            for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript;
            setInput(transcript);
        };
        recRef.current.onerror = () => setListening(false);
        recRef.current.onend = () => setListening(false);
    };
    const stopListening = () => { if (recRef.current) recRef.current.stop(); setListening(false); };

    useEffect(() => {
        return () => {
            const audio = audioRef.current;
            if (audio) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch { }
                cleanupAudioInstance(audio);
            }
            try { recRef.current?.stop?.(); } catch { }
        };
    }, []);

    // WS helper
    const sendOverWS = (payload) => {
        if (wsRef.current && wsReady) {
            wsRef.current.send(JSON.stringify(payload));
            return true;
        }
        return false;
    };

    const send = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const newMsgs = [...messages, { role: 'user', content: trimmed }];
        setMessages(newMsgs);
        setInput('');
        setLoading(true);

        // Prefer WSS (server will also handle redirects & push 'redirect' event)
        const wsSent = sendOverWS({
            messages: newMsgs,
            tts: true,
            language: 'en-IN',
            gender: 'FEMALE',
            debug: true,
        });

        if (wsSent) {
            setLoading(false);
            return;
        }

        // Fallback to HTTP if WS not available (no client-side redirect detection here)
        try {
            const data = await fetchData('/api/assistant/chat', {
                method: 'POST',
                body: {
                    messages: newMsgs,
                    tts: true,
                    language: 'en-IN',
                    gender: 'FEMALE',
                    debug: true,
                },
            });

            const assistantText = data?.message?.content || 'Sorry, I missed that.';
            setMessages((m) => [...m, { role: 'assistant', content: assistantText }]);

            if (data?.audioBase64 && speaking) {
                playBase64(data.audioBase64, data.audioEncoding);
            }
        } catch (e) {
            const raw = String(e?.message || '');
            const is401 = raw.includes(' 401 ') || /unauthorized/i.test(raw);
            if (is401) {
                let content = 'You are not signed in. Please log in to continue. Redirecting you to the login page…';
                try {
                    const m = raw.match(/\{[\s\S]*\}$/);
                    if (m) {
                        const parsed = JSON.parse(m[0]);
                        content = parsed?.message?.content || content;
                        if (parsed?.redirectTo) navigate(parsed.redirectTo);
                    }
                } catch { /* ignore parse errors */ }
                setMessages((m) => [...m, { role: 'assistant', content }]);
            } else {
                console.error('[AssistantWidget] Request failed', e);
                setMessages((m) => [...m, { role: 'assistant', content: 'I hit a snag. Please try again.' }]);
            }
        } finally {
            setLoading(false);
        }
    };

    const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

    const orb1Bg = `radial-gradient(closest-side, ${alpha(theme.palette.primary.main, 0.18)}, transparent)`;
    const orb2Bg = `radial-gradient(closest-side, ${alpha(theme.palette.primary.light, 0.18)}, transparent)`;

    return (
        <>
            <FabShell component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <AnimatePresence>
                    {!open && countForBadge > 0 && (
                        <motion.div key="badge-pop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                            style={{ position: 'absolute', right: -2, bottom: 58, zIndex: 1 }}>
                            <Badge badgeContent={countForBadge} color="error"
                                sx={{ '& .MuiBadge-badge': { transform: 'scale(1.1)', fontWeight: 700, border: '2px solid #fff' } }} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <FabButton onClick={() => setOpen((s) => !s)} aria-label="Open assistant">
                    <ChatBubbleOutlineRoundedIcon />
                </FabButton>
            </FabShell>

            <AnimatePresence>
                {open && (
                    <Panel component={motion.div} initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} transition={{ duration: 0.28 }} elevation={0}>
                        <GlowOrb style={{ width: 240, height: 240, left: -40, top: 110, background: orb1Bg, animation: `${float} 11s ease-in-out infinite` }} />
                        <GlowOrb style={{ width: 220, height: 220, right: -40, bottom: 160, background: orb2Bg, animation: `${float} 10s ease-in-out infinite` }} />

                        <Header>
                            <Stack direction="row" spacing={1.2} alignItems="center">
                                <Avatar sx={{
                                    width: 38, height: 38,
                                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                                    boxShadow: isDark ? '0 10px 22px rgba(0,0,0,.55)' : '0 10px 22px rgba(25,118,210,.35)',
                                    fontWeight: 900,
                                }}>A</Avatar>
                                <Box>
                                    <Typography sx={{ fontWeight: 900, letterSpacing: 0.2, lineHeight: 1 }}>
                                        AI Assistant
                                    </Typography>
                                    <Chip size="small" label={wsReady ? "Online" : "Connecting…"} color={wsReady ? "success" : "warning"} variant="outlined" sx={{ height: 22, mt: 0.25 }} />
                                </Box>
                            </Stack>

                            <Stack direction="row" spacing={0.5} alignItems="center">
                                {isPlaying ? (
                                    <Tooltip title="Pause voice"><IconButton size="small" onClick={pauseAudio}><PauseCircleRoundedIcon /></IconButton></Tooltip>
                                ) : (
                                    <Tooltip title="Resume voice"><IconButton size="small" onClick={resumeAudio}><PlayCircleRoundedIcon /></IconButton></Tooltip>
                                )}
                                <Tooltip title={speaking ? 'Voice on' : 'Voice off'}>
                                    <IconButton size="small" onClick={() => setSpeaking((s) => !s)}>
                                        {speaking ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
                                    </IconButton>
                                </Tooltip>
                                <IconButton size="small" onClick={() => { stopAudio(); setOpen(false); }}>
                                    <CloseRoundedIcon />
                                </IconButton>
                            </Stack>
                        </Header>

                        <ScrollArea ref={scrollRef}>
                            {messages.map((m, i) => (<Bubble key={i} role={m.role}>{m.content}</Bubble>))}
                            {loading && (
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                                    <CircularProgress size={18} />
                                    <Typography variant="caption" color="text.secondary">Thinking…</Typography>
                                </Stack>
                            )}
                        </ScrollArea>

                        <Divider />

                        <Box sx={{ p: 1.1 }}>
                            <Stack direction="row" spacing={1} alignItems="flex-end">
                                <TextField
                                    size="small" fullWidth multiline minRows={1} maxRows={6}
                                    placeholder="Type your message…" value={input}
                                    onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} variant="outlined"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 3, background: theme.palette.background.paper,
                                            boxShadow: isDark ? '0 6px 16px rgba(0,0,0,.55)' : '0 6px 16px rgba(2,11,31,.08)',
                                            alignItems: 'flex-end',
                                        },
                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.6) },
                                    }}
                                />
                                <Tooltip title={supportsSTT() ? (listening ? 'Stop' : 'Speak') : 'Voice not supported'}>
                                    <Box>
                                        <IconButton
                                            onClick={listening ? stopListening : startListening}
                                            disabled={!supportsSTT()}
                                            sx={{
                                                bgcolor: listening ? alpha(theme.palette.primary.main, .10) : 'transparent',
                                                animation: listening ? `${pulse} 1.8s ease-out infinite` : 'none'
                                            }}
                                        >
                                            {listening ? <StopCircleRoundedIcon /> : <KeyboardVoiceRoundedIcon />}
                                        </IconButton>
                                    </Box>
                                </Tooltip>
                                <Button
                                    variant="contained" onClick={send} disabled={loading || !input.trim()}
                                    endIcon={<SendRoundedIcon />} sx={{ borderRadius: 999, px: 2.2 }}
                                >
                                    Send
                                </Button>
                            </Stack>
                        </Box>
                    </Panel>
                )}
            </AnimatePresence>
        </>
    );
};

export default AssistantWidget;
