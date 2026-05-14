import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, TextField, Button, IconButton,
    Divider, CircularProgress, Stack, Tooltip, Chip, InputAdornment,
} from '@mui/material';
import {
    CloseRounded, SaveRounded, AddRounded, DeleteRounded,
    RecordVoiceOverRounded, QuizRounded, PsychologyRounded,
    EditNoteRounded, CheckRounded, PhoneRounded, StarRounded,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { fetchData } from '../../AppUtils/dataAPI';

const DEFAULT_BASIC = [
    'What is your current job role?',
    'How many years of experience do you have in this field?',
];

const DEFAULT_SKILLS_PROMPT = 'Please share your top 3 skills and how many years of experience you have in each.';

const EMPTY_FORM = {
    name: 'Default Inbound Script',
    greeting: 'Hello! Thank you for calling. I am an AI recruiter. I will ask you a few quick questions.',
    jobQuestion: 'Which job position are you calling about?',
    companyQuestion: 'Which company are you currently working for?',
    basicQuestions: [...DEFAULT_BASIC],
    skillsPrompt: DEFAULT_SKILLS_PROMPT,
    numbers: [],
};

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, label }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.2 }}>
            <Box sx={{ color: 'primary.main', display: 'flex', fontSize: 17 }}>{icon}</Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                {label}
            </Typography>
        </Box>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InboundCallScriptPanel({ onClose }) {
    const [script, setScript] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [newNumber, setNewNumber] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchData('/api/inbound-call-scripts/');
            setScript(res || null);
            if (res) {
                setForm({
                    name: res.name || EMPTY_FORM.name,
                    greeting: res.greeting || EMPTY_FORM.greeting,
                    jobQuestion: res.jobQuestion || EMPTY_FORM.jobQuestion,
                    companyQuestion: res.companyQuestion || EMPTY_FORM.companyQuestion,
                    basicQuestions: res.basicQuestions?.length ? res.basicQuestions : [...DEFAULT_BASIC],
                    skillsPrompt: res.skillsPrompt || DEFAULT_SKILLS_PROMPT,
                    numbers: res.numbers || [],
                });
            } else {
                setForm({ ...EMPTY_FORM, basicQuestions: [...DEFAULT_BASIC], skillsPrompt: DEFAULT_SKILLS_PROMPT, numbers: [] });
            }
        } catch {
            setForm({ ...EMPTY_FORM, basicQuestions: [...DEFAULT_BASIC], skillsPrompt: DEFAULT_SKILLS_PROMPT, numbers: [] });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

    // Basic questions helpers
    const setBasic = (i, val) =>
        setForm((f) => { const q = [...f.basicQuestions]; q[i] = val; return { ...f, basicQuestions: q }; });
    const addBasic = () =>
        setForm((f) => ({ ...f, basicQuestions: [...f.basicQuestions, ''] }));
    const removeBasic = (i) =>
        setForm((f) => ({ ...f, basicQuestions: f.basicQuestions.filter((_, idx) => idx !== i) }));

    // Phone numbers helpers
    const addNumber = () => {
        const n = newNumber.trim();
        if (!n) return;
        const normalized = n.startsWith('+') ? n : '+' + n;
        if (form.numbers.includes(normalized)) { setNewNumber(''); return; }
        setForm((f) => ({ ...f, numbers: [...f.numbers, normalized] }));
        setNewNumber('');
    };
    const removeNumber = (i) =>
        setForm((f) => ({ ...f, numbers: f.numbers.filter((_, idx) => idx !== i) }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...form,
                basicQuestions: form.basicQuestions.filter((q) => q?.trim()),
                skillsPrompt: (form.skillsPrompt || '').trim(),
                numbers: form.numbers,
            };
            if (script?._id) {
                await fetchData(`/api/inbound-call-scripts/${script._id}`, { method: 'PUT', body: payload });
            } else {
                await fetchData('/api/inbound-call-scripts/', { method: 'POST', body: payload });
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            await load();
        } catch {
            // silently fail
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>

            {/* ── Panel header ── */}
            <Box
                sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 2.5, py: 1.8,
                    borderBottom: 1, borderColor: 'divider',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                    flexShrink: 0,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EditNoteRounded sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>Inbound Script</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {script && <Chip label="Active" size="small" color="success" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />}
                    <Tooltip title="Close">
                        <IconButton size="small" onClick={onClose}>
                            <CloseRounded sx={{ fontSize: 17 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <CircularProgress size={28} />
                </Box>
            ) : (
                <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, lineHeight: 1.5 }}>
                        Configure what the AI says to new callers not yet in the system.
                        Add your Telnyx/Plivo numbers so the system can route calls to this script instantly.
                    </Typography>

                    {/* Script name */}
                    <TextField
                        label="Script Name"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        fullWidth size="small" sx={{ mb: 2.5 }}
                    />

                    {/* ── Phone numbers ── */}
                    <SectionHeader icon={<PhoneRounded fontSize="inherit" />} label="Your Inbound Numbers" />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.4 }}>
                        Add your Telnyx/Plivo numbers (e.g. +15512345678). Used to instantly identify which client a call belongs to — eliminates the DB search delay.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.8, mb: 1 }}>
                        <TextField
                            value={newNumber}
                            onChange={(e) => setNewNumber(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addNumber()}
                            size="small"
                            placeholder="+1XXXXXXXXXX"
                            sx={{ flex: 1 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <PhoneRounded sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Button size="small" variant="outlined" onClick={addNumber} sx={{ flexShrink: 0, minWidth: 48 }}>
                            <AddRounded sx={{ fontSize: 18 }} />
                        </Button>
                    </Box>
                    <Stack direction="row" flexWrap="wrap" gap={0.7} sx={{ mb: 2.5 }}>
                        {form.numbers.map((n, i) => (
                            <Chip
                                key={i}
                                label={n}
                                size="small"
                                color="primary"
                                variant="outlined"
                                onDelete={() => removeNumber(i)}
                                sx={{ fontSize: '0.75rem' }}
                            />
                        ))}
                        {form.numbers.length === 0 && (
                            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                No numbers added yet
                            </Typography>
                        )}
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    {/* ── Greeting ── */}
                    <SectionHeader icon={<RecordVoiceOverRounded fontSize="inherit" />} label="Opening Greeting" />
                    <TextField
                        value={form.greeting}
                        onChange={(e) => set('greeting', e.target.value)}
                        fullWidth size="small" multiline rows={2}
                        placeholder="What the AI says first…"
                        sx={{ mb: 2.5 }}
                    />

                    <Divider sx={{ mb: 2 }} />

                    {/* ── Discovery questions ── */}
                    <SectionHeader icon={<QuizRounded fontSize="inherit" />} label="Discovery Questions" />
                    <Stack spacing={1.5} sx={{ mb: 2.5 }}>
                        <TextField
                            label="Job Question"
                            value={form.jobQuestion}
                            onChange={(e) => set('jobQuestion', e.target.value)}
                            fullWidth size="small"
                            placeholder="Which job position are you calling about?"
                        />
                        <TextField
                            label="Company Question"
                            value={form.companyQuestion}
                            onChange={(e) => set('companyQuestion', e.target.value)}
                            fullWidth size="small"
                            placeholder="Which company are you currently working for?"
                        />
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    {/* ── Basic questions (dynamic) ── */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                        <SectionHeader icon={<QuizRounded fontSize="inherit" />} label="Basic Questions" />
                        {form.basicQuestions.length < 5 && (
                            <Tooltip title="Add question">
                                <IconButton size="small" onClick={addBasic} sx={{ color: 'primary.main', p: 0.4 }}>
                                    <AddRounded sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    <Stack spacing={1} sx={{ mb: 2.5 }}>
                        {form.basicQuestions.map((q, i) => (
                            <Box key={i} sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
                                <TextField
                                    value={q}
                                    onChange={(e) => setBasic(i, e.target.value)}
                                    fullWidth size="small"
                                    placeholder={`Question ${i + 1}…`}
                                />
                                {form.basicQuestions.length > 1 && (
                                    <Tooltip title="Remove">
                                        <IconButton size="small" onClick={() => removeBasic(i)}
                                            sx={{ color: 'error.main', p: 0.3, flexShrink: 0 }}>
                                            <DeleteRounded sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        ))}
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    {/* ── Skills prompt ── */}
                    <SectionHeader icon={<StarRounded fontSize="inherit" />} label="Skills Question" />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.4 }}>
                        The AI will ask this question to collect the candidate's top skills and years of experience. The candidate answers freely.
                    </Typography>
                    <TextField
                        value={form.skillsPrompt}
                        onChange={(e) => set('skillsPrompt', e.target.value)}
                        fullWidth size="small" multiline rows={2}
                        placeholder="e.g. Please share your top 3 skills and how many years of experience you have in each."
                        sx={{ mb: 3 }}
                    />
                </Box>
            )}

            {/* ── Save footer ── */}
            {!loading && (
                <Box
                    sx={{
                        px: 2.5, py: 1.8,
                        borderTop: 1, borderColor: 'divider',
                        flexShrink: 0,
                        display: 'flex', gap: 1, alignItems: 'center',
                        bgcolor: 'background.paper',
                    }}
                >
                    <Button
                        variant="contained"
                        fullWidth
                        size="small"
                        onClick={handleSave}
                        disabled={saving}
                        startIcon={saved ? <CheckRounded /> : saving ? <CircularProgress size={14} color="inherit" /> : <SaveRounded />}
                        color={saved ? 'success' : 'primary'}
                    >
                        {saved ? 'Saved!' : saving ? 'Saving…' : script ? 'Update Script' : 'Save Script'}
                    </Button>
                </Box>
            )}
        </Box>
    );
}