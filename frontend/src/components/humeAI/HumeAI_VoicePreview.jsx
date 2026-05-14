// frontend/src/components/humeAI/HumeAI_VoicePreview.jsx
import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, TextField, Button,
    Chip, CircularProgress, Alert, Slider, Divider,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import { fetchData } from '../../AppUtils/dataAPI';

// ─── Voice persona presets ─────────────────────────────────────────────────────
// Hume Octave TTS generates voices purely from natural language descriptions.
// These presets show the range of what's possible.
const PRESETS = [
    {
        label: 'Warm Recruiter',
        emoji: '🌸',
        description: 'Speak as a warm, caring female Indian recruiter. Your voice is soft and melodic with a gentle Indian English accent. You genuinely care about the person you are calling. Sound like a trusted friend, not a salesperson.',
    },
    {
        label: 'Confident Professional',
        emoji: '💼',
        description: 'Speak as a senior professional with calm authority and confidence. Clear, measured delivery. You are polished but warm — never cold or robotic. Medium-low pitch, deliberate pacing.',
    },
    {
        label: 'Startup Energy',
        emoji: '⚡',
        description: 'Speak with fast, genuine excitement. Young startup energy — enthusiastic, real, and peer-to-peer. Not corporate at all. Like a colleague sharing amazing news.',
    },
    {
        label: 'Calm & Nurturing',
        emoji: '🧘',
        description: 'Speak with infinite patience and warmth. Very slow, deliberate pacing with long gentle pauses. Like a mentor who has all the time in the world. Deeply reassuring.',
    },
    {
        label: 'Direct & Sharp',
        emoji: '🎯',
        description: 'Speak with directness and efficiency. Fast pace, short sentences. Honest and no-nonsense, but with warmth underneath. Respects the listener\'s time.',
    },
    {
        label: 'Deep Male Voice',
        emoji: '🏔️',
        description: 'Speak with a deep, resonant male voice. Low pitch with chest resonance. Calm authority — the voice of someone who has earned their position. Slow, powerful pacing.',
    },
    {
        label: 'Cheerful & Bright',
        emoji: '☀️',
        description: 'Speak with bright, positive energy. Higher pitch with lots of natural variation. Genuine enthusiasm that makes people smile. Light, natural laughs come through easily.',
    },
    {
        label: 'Hinglish & Friendly',
        emoji: '🙏',
        description: 'Speak as a young urban Indian who naturally mixes Hindi and English. Conversational and relaxed, like calling a friend. Natural "acha", "haan", "bilkul" mixed in organically.',
    },
];

const DEFAULT_TEXT = `Hi there! I'm calling from HireXit about an exciting opportunity that I think would be a great fit for your background. Do you have a couple of minutes to chat?`;

export default function HumeAI_VoicePreview() {
    const [text, setText]               = useState(DEFAULT_TEXT);
    const [description, setDescription] = useState(PRESETS[0].description);
    const [speed, setSpeed]             = useState(1.0);
    const [isLoading, setIsLoading]     = useState(false);
    const [isPlaying, setIsPlaying]     = useState(false);
    const [error, setError]             = useState(null);
    const [activePreset, setActivePreset] = useState(0);
    const audioRef = useRef(null);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            if (audioRef.current.src?.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
            audioRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    useEffect(() => () => stopAudio(), [stopAudio]);

    function selectPreset(idx) {
        setActivePreset(idx);
        setDescription(PRESETS[idx].description);
    }

    async function handlePreview() {
        if (!text.trim()) { setError('Please enter some text to preview'); return; }
        stopAudio();
        setError(null);
        setIsLoading(true);

        try {
            const res = await fetchData('/api/hume/preview', {
                method: 'POST',
                body: { text: text.trim(), description: description.trim(), speed },
            });

            if (!res.audioBase64) throw new Error('No audio returned from server');

            const binary = atob(res.audioBase64);
            const buf    = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
            const blob  = new Blob([buf], { type: 'audio/mpeg' });
            const url   = URL.createObjectURL(blob);
            const audio = new Audio(url);

            audio.onplay  = () => { setIsLoading(false); setIsPlaying(true); };
            audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; };
            audio.onerror = () => { setIsPlaying(false); setIsLoading(false); setError('Failed to play audio'); };
            audioRef.current = audio;
            await audio.play();

        } catch (err) {
            setError(err?.error || err?.details || err?.message || 'Preview failed');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Box sx={{ maxWidth: 820, mx: 'auto', p: { xs: 2, md: 4 } }}>

            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <GraphicEqRoundedIcon sx={{ fontSize: 30, color: 'primary.main' }} />
                    <Typography variant="h5" fontWeight={700}>Hume AI Voice Preview</Typography>
                    <Chip label="Octave TTS" size="small" color="primary" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Hume generates voices entirely from natural language descriptions — no fixed voice list. Describe the person and Hume creates the voice.
                </Typography>
            </Box>

            {/* Preset personas */}
            <Card variant="outlined" sx={{ mb: 2.5 }}>
                <CardContent sx={{ pb: '12px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <AutoAwesomeRoundedIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2" fontWeight={600}>Voice Personas</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            — click to load a preset description
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {PRESETS.map((p, i) => (
                            <Chip
                                key={p.label}
                                label={`${p.emoji} ${p.label}`}
                                clickable
                                onClick={() => selectPreset(i)}
                                variant={activePreset === i ? 'filled' : 'outlined'}
                                color={activePreset === i ? 'primary' : 'default'}
                                sx={{ fontSize: 13 }}
                            />
                        ))}
                    </Box>
                </CardContent>
            </Card>

            {/* Description — Hume's core feature */}
            <Card variant="outlined" sx={{ mb: 2.5, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AutoAwesomeRoundedIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2" fontWeight={600} color="primary.dark">
                            Voice Description
                        </Typography>
                        <Chip label="This IS the voice selector" size="small" color="primary" sx={{ ml: 'auto', fontSize: 10 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Describe the voice in plain English — gender, accent, age, emotion, pace, tone. Hume creates the voice from your description.
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={6}
                        value={description}
                        onChange={e => { setDescription(e.target.value); setActivePreset(-1); }}
                        placeholder="e.g. Warm female voice with an Indian accent, speaking slowly and with genuine care..."
                        inputProps={{ maxLength: 500 }}
                        helperText={`${description.length} / 500`}
                        size="small"
                    />
                </CardContent>
            </Card>

            {/* Text to speak */}
            <Card variant="outlined" sx={{ mb: 2.5 }}>
                <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Text to Speak</Typography>
                    <TextField
                        multiline
                        minRows={3}
                        maxRows={7}
                        fullWidth
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Enter the text you want Hume to speak..."
                        inputProps={{ maxLength: 2000 }}
                        helperText={`${text.length} / 2000`}
                        size="small"
                    />
                </CardContent>
            </Card>

            {/* Speed */}
            <Card variant="outlined" sx={{ mb: 2.5 }}>
                <CardContent sx={{ pb: '12px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <SpeedRoundedIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight={600}>Speed</Typography>
                        <Chip label={`${speed.toFixed(2)}×`} size="small" variant="outlined" sx={{ ml: 'auto' }} />
                    </Box>
                    <Slider
                        value={speed}
                        onChange={(_, val) => setSpeed(val)}
                        min={0.25} max={3.0} step={0.05}
                        marks={[{ value: 0.5, label: '0.5×' }, { value: 1.0, label: '1×' }, { value: 2.0, label: '2×' }]}
                        valueLabelDisplay="auto"
                        size="small"
                    />
                </CardContent>
            </Card>

            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                    {typeof error === 'string' ? error : JSON.stringify(error)}
                </Alert>
            )}

            {/* Play / Stop */}
            {isPlaying ? (
                <Button
                    variant="outlined" color="error" size="large" fullWidth
                    onClick={stopAudio} startIcon={<StopRoundedIcon />}
                    sx={{ py: 1.5, borderRadius: 2 }}
                >
                    Stop
                </Button>
            ) : (
                <Button
                    variant="contained" size="large" fullWidth
                    onClick={handlePreview}
                    disabled={isLoading || !text.trim()}
                    startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowRoundedIcon />}
                    sx={{ py: 1.5, borderRadius: 2 }}
                >
                    {isLoading ? 'Generating audio…' : 'Preview Voice'}
                </Button>
            )}

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {[
                    { label: 'Engine', value: 'Hume Octave TTS' },
                    { label: 'Voice control', value: 'Natural language description' },
                    { label: 'Output', value: 'MP3 audio' },
                ].map(item => (
                    <Box key={item.label} sx={{ display: 'flex', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">{item.label}:</Typography>
                        <Typography variant="caption" fontWeight={600}>{item.value}</Typography>
                    </Box>
                ))}
            </Box>

        </Box>
    );
}
