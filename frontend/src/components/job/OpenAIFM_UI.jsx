import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    InputBase,
    Grid,
    Card,
    useTheme,
    alpha,
    CircularProgress,
    Button,
    Chip,
    TextField,
    Collapse,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import {
    Close as CloseIcon,
    Download as DownloadIcon,
    PlayArrow as PlayIcon,
    Share as ShareIcon,
    History as HistoryIcon,
    Speaker as SpeakerIcon,
    GraphicEq as GraphicEqIcon,
    Add as AddIcon,
    AutoAwesome as MagicIcon,
    Stop as StopIcon,
} from '@mui/icons-material';
import MUIModal from '../MUI/commonUI/MUIModal';
import {
    useVoicePreview,
    OPENAI_VOICES,
    VIBES,
    VIBES_BY_GENDER,
    VOICES_BY_GENDER,
    EMOTION_TAGS,
} from './useVoicePreview';

// ─── helpers ────────────────────────────────────────────────────────────────

const GENDER_CONFIG = {
    female: { label: 'Female', emoji: '👩', accent: '#FF4D00', light: '#FFE5CC', border: '#FF4D00' },
    male:   { label: 'Male',   emoji: '👨', accent: '#1976d2', light: '#CCE5FF', border: '#1976d2' },
    neutral:{ label: 'Neutral',emoji: '⚖️', accent: '#757575', light: '#E8E8E8', border: '#757575' },
};

function getVoiceGender(voiceId) {
    const v = OPENAI_VOICES.find(v => v.id === voiceId);
    return v?.gender || 'neutral';
}

// Build a structured vibe prompt using the Affect/Voice/Tone/Pacing/Pronunciation/Emotion format
function buildCustomPrompt({ name, city, accent, tone, pace, emotions, extra }) {
    const emotionLines = {
        laugh:   'Natural genuine laughs — [laughs softly] — real, from the chest, never forced.',
        pause:   'Use real pauses of 1–2 seconds before key information. Let silence carry weight.',
        empathy: 'When the person sounds uncertain, soften voice, slow down, be genuinely present.',
        cry:     'Let real emotional warmth through when something important is said — a genuine human moment.',
        excited: 'Voice actually brightens on good news — real excitement, not performed energy.',
        calm:    'Nothing rattles you. Silence is comfortable. Steady pace throughout. You are the anchor.',
        warm:    'Voice smiles — warmth is in the sound itself, not just the words.',
        direct:  'No filler, no padding. Clear and confident. Every word earns its place.',
    };

    const selectedLines = emotions
        .map(e => emotionLines[e])
        .filter(Boolean)
        .map(l => `- ${l}`)
        .join('\n');

    return `Affect: You are ${name || 'an Indian recruiter'} calling from ${city || 'India'}.${extra ? ` ${extra}.` : ''} You are genuinely invested in this conversation.

Voice: ${tone || 'Warm, genuine, natural Indian voice — medium pitch, clear and pleasant to listen to.'}.

Tone: Real and human — not corporate, not scripted. A real person having a real conversation.

Pacing: ${pace || 'Unhurried Indian conversational pace — warmer and slower than American English. Natural breath pauses between clauses.'}.

Pronunciation: ${accent || 'Natural Indian English accent — sentences end with a gentle upward melody (characteristic Indian intonation), retroflex \'t\' and \'d\' sounds (fuller and warmer), clean \'r\' tap, open clear vowels. Speak with this accent consistently throughout.'}

Emotion:
${selectedLines || '- Sound like a real person — natural pauses, genuine reactions, warmth in every sentence.'}
- Natural Indian sounds: "hmm" when thinking, "right?" at end of statements. This is a real conversation, not a recording.`;
}

// ─── component ──────────────────────────────────────────────────────────────

const OpenAIFM_UI = ({ open, onClose, onConfirm, initialVoice, initialInstructions, initialScript }) => {
    const theme = useTheme();
    const { isPlaying, isLoadingAudio, previewVoiceOpenAI, pauseVoice } = useVoicePreview();

    const [selectedVoice, setSelectedVoice] = useState(initialVoice || 'coral');
    const [selectedVibe, setSelectedVibe] = useState(null);
    const [scriptContent, setScriptContent] = useState(initialScript || '');

    // Custom vibe builder state
    const [showCustomBuilder, setShowCustomBuilder] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customCity, setCustomCity] = useState('');
    const [customAccent, setCustomAccent] = useState('');
    const [customTone, setCustomTone] = useState('');
    const [customPace, setCustomPace] = useState('');
    const [customEmotions, setCustomEmotions] = useState([]);
    const [customExtra, setCustomExtra] = useState('');
    const [customVibe, setCustomVibe] = useState(null); // generated custom vibe

    // Derive gender of selected voice
    const selectedGender = getVoiceGender(selectedVoice);
    const cfg = GENDER_CONFIG[selectedGender];

    // Vibes filtered to match selected voice gender
    const filteredVibes = VIBES_BY_GENDER[selectedGender] || [];

    // When voice changes, reset vibe selection if incompatible
    useEffect(() => {
        if (selectedVibe && selectedVibe.gender !== selectedGender && selectedVibe.id !== 'custom') {
            setSelectedVibe(filteredVibes[0] || null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGender]);

    // Initialise from props
    useEffect(() => {
        if (initialVoice) setSelectedVoice(initialVoice);
        if (initialInstructions) {
            const match = VIBES.find(v => v.prompt === initialInstructions);
            setSelectedVibe(match || null);
        }
        if (initialScript) setScriptContent(initialScript);
    }, [initialVoice, initialInstructions, initialScript, open]);

    // Set default vibe when filtered list first loads
    useEffect(() => {
        if (!selectedVibe && filteredVibes.length > 0) {
            setSelectedVibe(filteredVibes[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredVibes.length]);

    // Stop audio when modal closes
    useEffect(() => {
        return () => { if (!open) pauseVoice(); };
    }, [open, pauseVoice]);

    const handleVibeSelect = (vibe) => {
        setSelectedVibe(vibe);
        setShowCustomBuilder(false);
        if (vibe.voice) setSelectedVoice(vibe.voice);
    };

    const handleCustomBuild = () => {
        const built = {
            id: 'custom',
            name: customName || 'My Custom Vibe',
            description: 'Your custom voice personality',
            gender: selectedGender,
            voice: selectedVoice,
            emotions: customEmotions,
            prompt: buildCustomPrompt({
                name: customName,
                city: customCity,
                accent: customAccent,
                tone: customTone,
                pace: customPace,
                emotions: customEmotions,
                extra: customExtra,
            }),
        };
        setCustomVibe(built);
        setSelectedVibe(built);
        setShowCustomBuilder(false);
    };

    const activePrompt = selectedVibe?.prompt || '';

    // ── render ───────────────────────────────────────────────────────────────
    return (
        <MUIModal
            open={open}
            onClose={onClose}
            contentSx={{
                width: { xs: '95vw', sm: '90vw', md: '82vw', lg: '72vw' },
                maxWidth: '1140px',
                p: 0,
                borderRadius: 0,
                bgcolor: '#EDEDED',
                overflow: 'hidden',
                maxHeight: '95vh',
            }}
        >
            {/* ── Header ── */}
            <Box sx={{
                px: 3, py: 1.5,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid #D1D1D1', bgcolor: '#EDEDED',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <GraphicEqIcon sx={{ color: '#FF4D00', fontSize: '1.4rem' }} />
                    <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2 }}>
                            AI VOICE DESIGNER
                        </Typography>
                        <Typography sx={{ fontSize: '0.63rem', color: '#FF4D00', fontWeight: 700, letterSpacing: 1.2 }}>
                            OPTIMIZED FOR INDIA · DESI VOICES
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" /></IconButton>
            </Box>

            {/* ── Scrollable body ── */}
            <Box sx={{
                px: { xs: 2, md: 3 }, py: 2.5,
                display: 'flex', flexDirection: 'column', gap: 3,
                overflowY: 'auto', maxHeight: 'calc(95vh - 130px)',
                '&::-webkit-scrollbar': { width: 5 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#CCC', borderRadius: 3 },
            }}>

                {/* ── VOICE ── */}
                <Box>
                    <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, color: '#666' }}>
                        VOICE
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999', ml: 1, fontSize: '0.65rem' }}>
                        · vibes auto-filter to match
                    </Typography>

                    {(['female', 'male', 'neutral']).map(g => {
                        const gc = GENDER_CONFIG[g];
                        const voices = VOICES_BY_GENDER[g];
                        if (!voices.length) return null;
                        return (
                            <Box key={g} sx={{ mt: 2 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: gc.accent, fontSize: '0.72rem', mb: 1, display: 'block' }}>
                                    {gc.emoji} {gc.label.toUpperCase()} VOICES
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                    {voices.map(v => (
                                        <Card
                                            key={v.id}
                                            onClick={() => setSelectedVoice(v.id)}
                                            sx={{
                                                minWidth: 90, height: 80,
                                                bgcolor: selectedVoice === v.id ? gc.light : 'white',
                                                borderRadius: 1,
                                                border: selectedVoice === v.id ? `2.5px solid ${gc.border}` : '1px solid #E0E0E0',
                                                display: 'flex', flexDirection: 'column', p: 1.5,
                                                cursor: 'pointer', transition: 'all 0.18s',
                                                '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 4px 12px ${alpha(gc.accent, 0.2)}` },
                                            }}
                                        >
                                            <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{v.label}</Typography>
                                            <Typography sx={{ color: '#999', fontSize: '0.67rem', mt: 0.3, lineHeight: 1.2 }}>{v.description}</Typography>
                                            <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: selectedVoice === v.id ? gc.accent : '#E0E0E0' }} />
                                                <SpeakerIcon sx={{ fontSize: '0.85rem', color: '#CCC' }} />
                                            </Box>
                                        </Card>
                                    ))}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>

                {/* ── SCRIPT ── */}
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, color: '#666' }}>SCRIPT</Typography>
                        <HistoryIcon sx={{ color: '#999', fontSize: '1.1rem' }} />
                    </Box>
                    <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #E0E0E0', height: 160, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ flex: 1, overflowY: 'auto' }}>
                            <InputBase
                                multiline fullWidth
                                placeholder="Paste your script here to preview..."
                                value={scriptContent}
                                onChange={e => setScriptContent(e.target.value)}
                                sx={{ fontSize: '0.88rem', lineHeight: 1.5, p: 0 }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: '#BBB', fontSize: '0.7rem' }}>
                                {scriptContent.length} / 4000
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {/* ── VIBE ── */}
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, color: '#666' }}>VIBE</Typography>
                        <Box sx={{ px: 1, py: 0.2, bgcolor: cfg.light, borderRadius: 0.5 }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: cfg.accent, letterSpacing: 0.8 }}>
                                {cfg.emoji} {cfg.label.toUpperCase()} VIBES
                            </Typography>
                        </Box>
                    </Box>

                    <Grid container spacing={1.5}>
                        {/* Preset vibe cards */}
                        {filteredVibes.map(v => (
                            <Grid item xs={6} sm={4} md={3} key={v.id}>
                                <VibeCard
                                    vibe={v}
                                    selected={selectedVibe?.id === v.id}
                                    accentColor={cfg.accent}
                                    lightColor={cfg.light}
                                    onClick={() => handleVibeSelect(v)}
                                />
                            </Grid>
                        ))}

                        {/* Custom vibe card (if built) */}
                        {customVibe && (
                            <Grid item xs={6} sm={4} md={3}>
                                <VibeCard
                                    vibe={customVibe}
                                    selected={selectedVibe?.id === 'custom'}
                                    accentColor={cfg.accent}
                                    lightColor={cfg.light}
                                    onClick={() => handleVibeSelect(customVibe)}
                                    isCustom
                                />
                            </Grid>
                        )}

                        {/* + Create custom card */}
                        <Grid item xs={6} sm={4} md={3}>
                            <Card
                                onClick={() => setShowCustomBuilder(v => !v)}
                                sx={{
                                    p: 1.5, height: 105,
                                    bgcolor: showCustomBuilder ? '#FFF7F0' : 'white',
                                    borderRadius: 1,
                                    border: showCustomBuilder ? `2px dashed ${cfg.accent}` : '1.5px dashed #CCC',
                                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 0.5,
                                    transition: 'all 0.2s',
                                    '&:hover': { borderColor: cfg.accent, bgcolor: '#FFF7F0' },
                                }}
                            >
                                <AddIcon sx={{ color: showCustomBuilder ? cfg.accent : '#AAA', fontSize: '1.4rem' }} />
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: showCustomBuilder ? cfg.accent : '#999' }}>
                                    CREATE CUSTOM
                                </Typography>
                                <Typography sx={{ fontSize: '0.62rem', color: '#BBB', textAlign: 'center', lineHeight: 1.2 }}>
                                    Build your own vibe
                                </Typography>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* ── Custom Vibe Builder ── */}
                    <Collapse in={showCustomBuilder}>
                        <Box sx={{ mt: 2, p: 2.5, bgcolor: 'white', borderRadius: 1, border: `1.5px solid ${cfg.accent}` }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <MagicIcon sx={{ color: cfg.accent, fontSize: '1.1rem' }} />
                                <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#333' }}>
                                    BUILD YOUR CUSTOM VIBE
                                </Typography>
                            </Box>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        size="small" fullWidth
                                        label="Character Name"
                                        placeholder="e.g. Anjali, Rohan, Priya..."
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        sx={tfSx}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        size="small" fullWidth
                                        label="City / Region"
                                        placeholder="e.g. Delhi, Mumbai, Bangalore..."
                                        value={customCity}
                                        onChange={e => setCustomCity(e.target.value)}
                                        sx={tfSx}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        size="small" fullWidth
                                        label="Accent Style"
                                        placeholder="e.g. Clear Hindi-accented English..."
                                        value={customAccent}
                                        onChange={e => setCustomAccent(e.target.value)}
                                        sx={tfSx}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        size="small" fullWidth
                                        label="Tone"
                                        placeholder="e.g. Warm and friendly, Direct and confident..."
                                        value={customTone}
                                        onChange={e => setCustomTone(e.target.value)}
                                        sx={tfSx}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        size="small" fullWidth
                                        label="Pace"
                                        placeholder="e.g. Quick but clear, Slow and deliberate..."
                                        value={customPace}
                                        onChange={e => setCustomPace(e.target.value)}
                                        sx={tfSx}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        size="small" fullWidth
                                        label="Extra personality (optional)"
                                        placeholder="e.g. Loves cricket, very patient, startup mindset..."
                                        value={customExtra}
                                        onChange={e => setCustomExtra(e.target.value)}
                                        sx={tfSx}
                                    />
                                </Grid>

                                {/* Emotion toggles */}
                                <Grid item xs={12}>
                                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#666', mb: 1, letterSpacing: 0.8 }}>
                                        EMOTIONS &amp; REALISM
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {Object.entries(EMOTION_TAGS).map(([key, tag]) => {
                                            const active = customEmotions.includes(key);
                                            return (
                                                <Chip
                                                    key={key}
                                                    label={`${tag.emoji} ${tag.label}`}
                                                    size="small"
                                                    onClick={() => setCustomEmotions(prev =>
                                                        active ? prev.filter(e => e !== key) : [...prev, key]
                                                    )}
                                                    sx={{
                                                        fontWeight: 600, fontSize: '0.7rem',
                                                        bgcolor: active ? alpha(tag.color, 0.15) : '#F5F5F5',
                                                        color: active ? tag.color : '#888',
                                                        border: active ? `1.5px solid ${tag.color}` : '1px solid #E0E0E0',
                                                        cursor: 'pointer',
                                                        '&:hover': { bgcolor: alpha(tag.color, 0.1) },
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                </Grid>
                            </Grid>

                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<MagicIcon />}
                                onClick={handleCustomBuild}
                                sx={{
                                    mt: 2.5, bgcolor: cfg.accent,
                                    '&:hover': { bgcolor: alpha(cfg.accent, 0.85) },
                                    fontWeight: 800, borderRadius: 1, textTransform: 'uppercase',
                                    letterSpacing: 1,
                                }}
                            >
                                Generate My Vibe
                            </Button>
                        </Box>
                    </Collapse>

                    {/* Active vibe prompt preview */}
                    {activePrompt && (
                        <Box sx={{
                            mt: 2, p: 2,
                            bgcolor: alpha('#EDEDED', 0.6),
                            borderRadius: 1, border: '1px dashed #CCC',
                        }}>
                            {selectedVibe?.emotions?.length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 1.2 }}>
                                    {selectedVibe.emotions.map(e => {
                                        const tag = EMOTION_TAGS[e];
                                        if (!tag) return null;
                                        return (
                                            <Box key={e} sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.2, borderRadius: 10, bgcolor: alpha(tag.color, 0.1), border: `1px solid ${alpha(tag.color, 0.3)}` }}>
                                                <Typography sx={{ fontSize: '0.65rem' }}>{tag.emoji}</Typography>
                                                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: tag.color }}>{tag.label}</Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                            <Typography sx={{ whiteSpace: 'pre-wrap', color: '#666', fontSize: '0.78rem', lineHeight: 1.5 }}>
                                {activePrompt}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* ── Footer ── */}
            <Box sx={{
                px: { xs: 2, md: 3 }, py: 2,
                bgcolor: '#EDEDED', borderTop: '1px solid #D1D1D1',
                display: 'flex', gap: 1.5, alignItems: 'center',
            }}>
                {/* Play / Stop */}
                <Button
                    variant="contained"
                    disabled={isLoadingAudio && !isPlaying}
                    startIcon={
                        isLoadingAudio && !isPlaying
                            ? <CircularProgress size={18} color="inherit" />
                            : isPlaying ? <StopIcon /> : <PlayIcon />
                    }
                    onClick={() => {
                        if (isPlaying) {
                            pauseVoice();
                        } else if (!isLoadingAudio) {
                            previewVoiceOpenAI({
                                text: scriptContent ||
                                    'Hello! So, I am calling from the HR team. We actually came across your profile and I genuinely think you would be a really strong fit for this role. ' +
                                    'The team is wonderful — and the kind of work you would be doing here is... actually quite different from what most companies offer, right? ' +
                                    'I would love to tell you a bit more about it. Do you have a few minutes?',
                                voice: selectedVoice,
                                instructions: activePrompt,
                                setGState: () => {},
                            });
                        }
                    }}
                    sx={{
                        flex: 1,
                        bgcolor: isLoadingAudio && !isPlaying ? '#CCC' : '#FF4D00',
                        '&:hover': { bgcolor: isLoadingAudio && !isPlaying ? '#CCC' : '#D44000' },
                        borderRadius: 1, fontWeight: 800, fontSize: '0.95rem',
                        textTransform: 'uppercase', letterSpacing: 1,
                        boxShadow: '0 4px 15px rgba(255,77,0,0.25)',
                    }}
                >
                    {isLoadingAudio && !isPlaying ? 'Generating...' : isPlaying ? 'Stop' : 'Play Preview'}
                </Button>

                <Button
                    variant="contained"
                    onClick={() => {
                        onConfirm?.({
                            voice: selectedVoice,
                            instructions: activePrompt,
                            vibeId: selectedVibe?.id || '',
                            script: scriptContent,
                        });
                        onClose();
                    }}
                    sx={{
                        bgcolor: theme.palette.primary.main,
                        px: 3.5, borderRadius: 1, fontWeight: 700,
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.85) },
                    }}
                >
                    Apply
                </Button>
            </Box>
        </MUIModal>
    );
};

// ─── VibeCard sub-component ──────────────────────────────────────────────────

function VibeCard({ vibe, selected, accentColor, lightColor, onClick, isCustom }) {
    return (
        <Card
            onClick={onClick}
            sx={{
                p: 1.5, height: 105,
                bgcolor: selected ? lightColor : 'white',
                borderRadius: 1,
                border: selected ? `2px solid ${accentColor}` : '1px solid #E0E0E0',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                transition: 'all 0.18s ease',
                '&:hover': { boxShadow: `0 4px 12px ${alpha(accentColor, 0.18)}`, borderColor: accentColor },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', lineHeight: 1.2, flex: 1, mr: 0.5 }}>
                    {vibe.name}
                </Typography>
                {isCustom && (
                    <Box sx={{ px: 0.6, py: 0.1, bgcolor: alpha(accentColor, 0.12), borderRadius: 0.5 }}>
                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: accentColor }}>CUSTOM</Typography>
                    </Box>
                )}
            </Box>
            <Typography sx={{ color: '#888', fontSize: '0.65rem', lineHeight: 1.2, mt: 0.4, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {vibe.description}
            </Typography>
            <Box sx={{ mt: 0.6, display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                {(vibe.emotions || []).slice(0, 3).map(e => {
                    const tag = EMOTION_TAGS[e];
                    if (!tag) return null;
                    return (
                        <Typography key={e} sx={{ fontSize: '0.7rem' }} title={tag.label}>
                            {tag.emoji}
                        </Typography>
                    );
                })}
                {selected && (
                    <Box sx={{ ml: 'auto', width: 6, height: 6, borderRadius: '50%', bgcolor: accentColor, mt: 0.3 }} />
                )}
            </Box>
        </Card>
    );
}

const tfSx = {
    '& .MuiInputBase-root': { fontSize: '0.82rem', borderRadius: 1 },
    '& .MuiInputLabel-root': { fontSize: '0.78rem' },
};

export default OpenAIFM_UI;
