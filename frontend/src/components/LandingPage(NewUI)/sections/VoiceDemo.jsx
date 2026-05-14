import { Box, Container, Typography, Button, TextField, MenuItem, IconButton, Paper, useTheme, alpha, Tooltip, Stack, CircularProgress, Checkbox, FormControlLabel, Link } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Headphones, Mic, MicOff, Volume2, Globe, Radio, Sparkles, X, Settings, User, ArrowRight, ClipboardList, Download, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useVoiceSimulation } from '../hooks/useVoiceSimulation';
import { fetchData } from '../../../AppUtils/dataAPI';
import countryList from '../../../assets/CountryCodes.json';
import { getDemoCandidateId, getDemoJobIds } from './demoSessionConfig';

const WaveformBar = ({ index, isPlaying, isMuted }) => {
    return (
        <motion.div
            animate={{
                height: (isPlaying && !isMuted) ? [6, 28, 12, 35, 8, 22, 6] : [6, 10, 6],
                opacity: (isPlaying && !isMuted) ? [0.6, 1, 0.6] : 0.2
            }}
            transition={{
                duration: 1,
                repeat: Infinity,
                delay: index * 0.05,
                ease: "easeInOut"
            }}
            style={{
                width: 4,
                backgroundColor: '#EC6727',
                borderRadius: 2,
                margin: '0 1.5px'
            }}
        />
    );
};

const VoiceDemo = ({ embedded = false, showHeading = true, showcaseTitle, initialStep = 'welcome', demoSession = null, onRequestCapture, onDemoEnd, sx = {} }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [step, setStep] = useState(initialStep); // welcome, lead_form, otp, in_call, summary
    const demoJobIds = getDemoJobIds();
    const demoCandidateId = getDemoCandidateId();

    const [mode, setMode] = useState('normal');
    const [job, setJob] = useState('FullStack Developer');
    const [candidateName, setCandidateName] = useState('');
    const [callDuration, setCallDuration] = useState(0);
    const [loading, setLoading] = useState(false);

    // Lead Form State
    const [leadForm, setLeadForm] = useState({
        firstName: "",
        lastName: "",
        mobile: "",
        countryCode: "+91",
        email: "",
        company: "",
        terms: false
    });

    const [otp, setOtp] = useState("");
    const [callUUID, setCallUUID] = useState(null);
    const [candidateId, setCandidateId] = useState(demoCandidateId);
    const [jobId, setJobId] = useState(demoJobIds["FullStack Developer"]);
    const [summaryData, setSummaryData] = useState(null);
    const [transcriptPreview, setTranscriptPreview] = useState(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
    const startedSessionRef = useRef('');
    const wasInCallRef = useRef(false);
    const demoCompletedRef = useRef('');

    const {
        isConnected,
        status: voiceStatus,
        isMuted,
        setIsMuted,
        startCall,
        endCall
    } = useVoiceSimulation();

    useEffect(() => {
        let timer;
        if (isConnected && voiceStatus === 'In Call') {
            wasInCallRef.current = true;
            timer = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else if (voiceStatus === 'Call Ended') {
            if (wasInCallRef.current) {
                setStep('summary');
                if (demoSession?.callUUID && demoCompletedRef.current !== demoSession.callUUID) {
                    demoCompletedRef.current = demoSession.callUUID;
                    onDemoEnd?.(demoSession);
                }
            }
            wasInCallRef.current = false;
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(timer);
    }, [demoSession, isConnected, onDemoEnd, voiceStatus]);

    useEffect(() => {
        setStep(initialStep);
    }, [initialStep]);

    useEffect(() => {
        if (!demoSession) {
            return;
        }

        if (callUUID && callUUID !== demoSession.callUUID && isConnected) {
            endCall();
        }

        setMode(demoSession.mode || 'normal');
        setJob(demoSession.jobTitle || 'FullStack Developer');
        setLeadForm((current) => ({
            ...current,
            ...demoSession.leadForm
        }));
        setCandidateId(demoSession.candidateId || demoCandidateId);
        setJobId(demoSession.jobId || demoJobIds[demoSession.jobTitle] || demoJobIds['FullStack Developer']);
        setCallUUID(demoSession.callUUID);
        setTranscriptPreview(null);
        setAudioPreviewUrl(null);
        setSummaryData(null);
        setOtp('');
        demoCompletedRef.current = '';
        wasInCallRef.current = false;
        setStep('in_call');
    }, [demoSession]);

    useEffect(() => {
        if (!demoSession?.callUUID || step !== 'in_call') {
            return;
        }

        if (startedSessionRef.current === demoSession.callUUID) {
            return;
        }

        let isCancelled = false;
        startedSessionRef.current = demoSession.callUUID;
        setLoading(true);

        const beginDemoCall = async () => {
            try {
                await startCall(
                    demoSession.candidateId || candidateId,
                    demoSession.jobId || jobId,
                    demoSession.callUUID,
                    demoSession.mode || mode,
                    demoSession.leadForm?.firstName || leadForm.firstName
                );
            } catch (error) {
                console.error('Auto Start Call Error:', error);
                if (!isCancelled) {
                    alert('Failed to start the live demo call. Please try again.');
                    startedSessionRef.current = '';
                    setStep('welcome');
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        beginDemoCall();

        return () => {
            isCancelled = true;
        };
    }, [demoSession, step, startCall]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const selectedJobId = demoJobIds[job] || demoJobIds["FullStack Developer"];
            setJobId(selectedJobId);

            await fetchData('/api/demo/leads/email/send/otp/', {
                method: 'POST',
                body: {
                    ...leadForm,
                    demoOf: "AI Screening Call",
                    jobTitle: job,
                    jobId: selectedJobId
                }
            });
            setStep('otp');
        } catch (err) {
            console.error("OTP Send Error:", err);
            alert("Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await fetchData('/api/demo/leads/email/verify/otp/', {
                method: 'POST',
                body: {
                    ...leadForm,
                    otp,
                    demoOf: "AI Screening Call",
                    jobTitle: job,
                    jobId: jobId
                }
            });

            console.log("OTP Verify Success:", result);

            // Construct the exact callUUID expected by the backend (UUID + space + email)
            const baseUuid = `call_simulation_____${Date.now()}`;
            const formattedUuid = `${baseUuid} ${leadForm.email}`;
            setCallUUID(formattedUuid);

            // Use candidateId from response if available, else fallback
            const finalCandidateId = result?.candidateId || candidateId;
            const finalJobId = result?.jobId || jobId;

            setCandidateId(finalCandidateId);
            setJobId(finalJobId);

            setStep('in_call');

            // Start the actual voice call simulation with synchronized UUID and metadata
            await startCall(finalCandidateId, finalJobId, formattedUuid, mode, leadForm.firstName);
        } catch (err) {
            console.error("OTP Verify Error:", err);
            const errorMsg = err?.message || (typeof err === 'string' ? err : "Invalid OTP. Please try again.");
            alert(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTracker = async () => {
        try {
            setLoading(true);
            const res = await fetchData(`/api/candidates/tracker/demo/?ids=${candidateId}&jobId=${jobId}&callUUID=${callUUID}&candidateFirstName=${leadForm.firstName}&jobTitle=${job}`, {
                method: 'GET',
                headers: {
                    Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
            });
            const url = URL.createObjectURL(res);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${leadForm.firstName}_${job}_tracker.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            console.error("Tracker Download Error:", err);
            alert("Failed to download tracker.");
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async (type, isPreview = false) => {
        setLoading(true);
        try {
            const list = await fetchData(`/api/conversations/demo/?candidateId=${candidateId}&jobId=${jobId}&callUUID=${callUUID}&candidateFirstName=${leadForm.firstName}`);
            if (list && list[0]) {
                const messages = list[0].messages?.filter(m => m.role !== 'system') || [];
                const transcript = messages.map(m => {
                    const role = m.role === 'user' ? (leadForm.firstName || 'Candidate') : 'AI';
                    let content = m.content;

                    if (Array.isArray(content)) {
                        // Handle array of objects like [{"type": "...", "text": "..."}]
                        content = content.map(item => item.text || '').join(' ');
                    } else if (typeof content === 'object' && content !== null) {
                        // Handle single object
                        content = content.text || JSON.stringify(content);
                    }

                    return `${role}: ${content}`;
                }).join('\n\n');

                if (type === 'transcript') {
                    setAudioPreviewUrl(null); // Clear other preview
                    if (isPreview) {
                        setTranscriptPreview(transcript || "No transcript available yet.");
                    } else if (transcript) {
                        const blob = new Blob([transcript], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Transcript_${leadForm.firstName || 'Demo'}.txt`;
                        a.click();
                    } else {
                        alert("The transcript is still being generated. Please wait 10 seconds and try again.");
                    }
                } else if (type === 'audio') {
                    setTranscriptPreview(null); // Clear other preview
                    if (list[0].audio_url) {
                        if (isPreview) {
                            setAudioPreviewUrl(list[0].audio_url);
                        } else {
                            window.open(list[0].audio_url, '_blank');
                        }
                    } else {
                        alert("Audio recording is being processed. Please try again in 30 seconds.");
                    }
                }
            } else {
                alert("Summary data not found. Please wait a moment if the call just ended.");
            }
        } catch (err) {
            console.error("Summary Fetch Error:", err);
            alert("Error fetching summary. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const isFreeEmail = (email) => {
        const freeDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com"];
        const domain = email.split("@")[1];
        return freeDomains.includes(domain);
    };

    const getStatusColor = () => {
        if (step === 'in_call') {
            return isConnected ? (voiceStatus === 'In Call' ? '#10B981' : '#F59E0B') : '#94A3B8';
        }
        return '#94A3B8';
    };

    const getStatusText = () => {
        if (step === 'welcome') return 'Ready';
        if (step === 'lead_form') return 'Setup';
        if (step === 'otp') return 'Verifying';
        if (step === 'in_call') return voiceStatus.toUpperCase();
        if (step === 'summary') return 'CALL SUMMARY';
        return 'Ready';
    };

    return (
        <Box id={embedded ? undefined : 'voice-demo'} sx={{
            py: embedded ? 0 : { xs: 8, md: 10 },
            position: 'relative',
            overflow: embedded ? 'visible' : 'hidden',
            bgcolor: embedded ? 'transparent' : (isDark ? 'background.default' : '#F9FAFB'),
            width: '100%',
            ...sx
        }}>
            <Container maxWidth={embedded ? false : 'md'} disableGutters={embedded}>
                {showHeading && (
                    <Box sx={{ textAlign: 'center', mb: embedded ? 4 : 6 }}>
                        <Typography
                            variant="h3"
                            sx={{
                                fontWeight: 850,
                                mb: 1.5,
                                fontSize: { xs: '2rem', md: '2.5rem' },
                                color: 'text.primary'
                            }}
                        >
                            Live AI Voice Demo
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto' }}>
                            Experience our low-latency AI interviewer in action. Powered by real-time voice synthesis.
                        </Typography>
                    </Box>
                )}

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

                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: embedded ? { xs: 4.5, md: 5.5 } : 8,
                        overflow: 'hidden',
                        position: 'relative',
                        background: isDark
                            ? 'linear-gradient(165deg, #1E293B 0%, #0F172A 100%)'
                            : '#FFFFFF',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0'}`,
                        minHeight: embedded
                            ? (step === 'welcome'
                                ? { xs: 390, md: 500 }
                                : step === 'in_call'
                                    ? { xs: 470, md: 580 }
                                    : step === 'summary'
                                        ? { xs: 430, md: 500 }
                                        : { xs: 560, md: 620 })
                            : (step === 'lead_form' ? '650px' : '520px'),
                        display: 'flex',
                        flexDirection: 'column',
                        p: { xs: embedded ? 1.9 : 3, md: embedded ? 2.4 : 5 },
                        boxShadow: embedded
                            ? (isDark ? 'none' : '0 30px 80px -40px rgba(15,23,42,0.35)')
                            : (isDark ? 'none' : '0 20px 50px -10px rgba(0,0,0,0.05)'),
                        transition: 'min-height 0.4s ease'
                    }}
                >
                    {/* Header Controls */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: embedded ? 2.2 : 4
                    }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{
                                width: embedded ? 10 : 12,
                                height: embedded ? 10 : 12,
                                borderRadius: '50%',
                                bgcolor: getStatusColor(),
                                boxShadow: `0 0 ${embedded ? 12 : 15}px ${alpha(getStatusColor(), 0.5)}`,
                                transition: 'all 0.3s ease'
                            }} className={isConnected ? "pulse-animation" : ""} />
                            <Box>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        fontWeight: 800,
                                        color: 'text.primary',
                                        lineHeight: 1,
                                        fontSize: embedded ? '0.9rem' : undefined
                                    }}
                                >
                                    {getStatusText()}
                                </Typography>
                                {step === 'in_call' && isConnected && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: 'text.secondary',
                                            fontFamily: 'monospace',
                                            fontSize: embedded ? '0.68rem' : undefined
                                        }}
                                    >
                                        {formatTime(callDuration)}
                                    </Typography>
                                )}
                            </Box>
                        </Stack>

                        <Box sx={{
                            display: 'flex',
                            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                            p: 0.5,
                            borderRadius: 3
                        }}>
                            {['normal', 'multilingual'].map((m) => (
                                <Button
                                    key={m}
                                    size="small"
                                    onClick={() => step === 'welcome' && setMode(m)}
                                    disabled={step !== 'welcome'}
                                    sx={{
                                        px: embedded ? 2.05 : 2.5,
                                        minWidth: embedded ? 104 : undefined,
                                        borderRadius: 2.5,
                                        fontSize: embedded ? '0.7rem' : '0.75rem',
                                        fontWeight: 800,
                                        textTransform: 'capitalize',
                                        color: mode === m ? 'white' : 'text.secondary',
                                        bgcolor: mode === m ? 'secondary.main' : 'transparent',
                                        opacity: step !== 'welcome' && mode !== m ? 0.5 : 1,
                                        '&:hover': {
                                            bgcolor: mode === m ? 'secondary.dark' : 'transparent'
                                        },
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                >
                                    {m}
                                </Button>
                            ))}
                        </Box>
                    </Box>

                    {/* Central Stage */}
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        justifyContent: 'center'
                    }}>
                        <AnimatePresence mode="wait">
                            {step === 'welcome' && (
                                <motion.div
                                    key="welcome"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    style={{ textAlign: 'center', position: 'relative' }}
                                >
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            mx: 'auto',
                                            width: embedded ? { xs: 124, md: 146 } : 200,
                                            height: embedded ? { xs: 124, md: 146 } : 200,
                                            mb: embedded ? 2.2 : 4
                                        }}
                                    >
                                        <Box sx={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '6px solid #FFF',
                                            boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.2)}`,
                                        }}>
                                            <Headphones size={embedded ? 42 : 64} color="white" />
                                        </Box>
                                    </Box>
                                    <Typography
                                        sx={{
                                            fontSize: embedded ? { xs: '1.08rem', md: '1.22rem' } : undefined,
                                            fontWeight: 800,
                                            lineHeight: 1.15,
                                            letterSpacing: embedded ? '-0.02em' : undefined,
                                            mb: embedded ? 1.45 : 2
                                        }}
                                        variant={embedded ? undefined : 'h5'}
                                    >
                                        Ready to experience the future?
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        endIcon={<ArrowRight />}
                                        onClick={() => {
                                            if (onRequestCapture) {
                                                onRequestCapture();
                                                return;
                                            }

                                            setStep('lead_form');
                                        }}
                                        sx={{
                                            height: embedded ? 46 : 56,
                                            px: embedded ? 2.8 : 4,
                                            borderRadius: embedded ? 3.2 : 4,
                                            fontWeight: 850,
                                            fontSize: embedded ? '0.86rem' : '1rem',
                                            boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.3)}`
                                        }}
                                    >
                                        Live Demo Now
                                    </Button>
                                </motion.div>
                            )}

                            {step === 'lead_form' && (
                                <motion.div
                                    key="lead_form"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    style={{ position: 'relative' }}
                                >
                                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, textAlign: 'center' }}>Candidate Registration</Typography>
                                    <Box component="form" onSubmit={handleSendOtp} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
                                        <TextField
                                            label="First Name"
                                            required
                                            fullWidth
                                            value={leadForm.firstName}
                                            onChange={(e) => setLeadForm({ ...leadForm, firstName: e.target.value })}
                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                        />
                                        <TextField
                                            label="Last Name"
                                            required
                                            fullWidth
                                            value={leadForm.lastName}
                                            onChange={(e) => setLeadForm({ ...leadForm, lastName: e.target.value })}
                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                        />
                                        <TextField
                                            select
                                            label="Country Code"
                                            required
                                            fullWidth
                                            value={leadForm.countryCode}
                                            onChange={(e) => setLeadForm({ ...leadForm, countryCode: e.target.value })}
                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                        >
                                            {countryList.map((country, index) => (
                                                <MenuItem key={`${country.code}-${index}`} value={country.dial_code}>
                                                    {country.dial_code} ({country.name})
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            label="Mobile"
                                            required
                                            fullWidth
                                            type="tel"
                                            value={leadForm.mobile}
                                            onChange={(e) => setLeadForm({ ...leadForm, mobile: e.target.value })}
                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                        />
                                        <TextField
                                            label="Business Email"
                                            required
                                            fullWidth
                                            type="email"
                                            value={leadForm.email}
                                            onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                                            error={!!(leadForm.email && isFreeEmail(leadForm.email))}
                                            helperText={(leadForm.email && isFreeEmail(leadForm.email)) ? "Please use a business email" : ""}
                                            sx={{ gridColumn: 'span 2', '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                        />
                                        <TextField
                                            label="Company Name"
                                            required
                                            fullWidth
                                            value={leadForm.company}
                                            onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                                            sx={{ gridColumn: 'span 2', '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                        />
                                        <Box sx={{ gridColumn: 'span 2' }}>
                                            <FormControlLabel
                                                control={<Checkbox checked={leadForm.terms} onChange={(e) => setLeadForm({ ...leadForm, terms: e.target.checked })} required />}
                                                label={<Typography variant="caption" color="text.secondary">I accept the <Link href="/termscondition" target="_blank">Terms and Conditions</Link></Typography>}
                                            />
                                        </Box>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            fullWidth
                                            disabled={!!(loading || (leadForm.email && isFreeEmail(leadForm.email)))}
                                            sx={{ gridColumn: 'span 2', height: 48, borderRadius: 3, fontWeight: 800 }}
                                        >
                                            {loading ? <CircularProgress size={24} /> : "Continue to OTP"}
                                        </Button>
                                    </Box>
                                </motion.div>
                            )}

                            {step === 'otp' && (
                                <motion.div
                                    key="otp"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    style={{ textAlign: 'center', position: 'relative' }}
                                >
                                    <Box sx={{ mb: 4 }}>
                                        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                                            <CheckCircle2 size={32} color={theme.palette.primary.main} />
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800 }}>Check Your Email</Typography>
                                        <Typography variant="body2" color="text.secondary">We've sent a 6-digit code to {leadForm.email}</Typography>
                                    </Box>
                                    <Box component="form" onSubmit={handleVerifyOtp} sx={{ maxWidth: 300, mx: 'auto' }}>
                                        <TextField
                                            fullWidth
                                            placeholder="000000"
                                            label="Verification Code"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', fontWeight: 800 } }}
                                            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
                                        />
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            fullWidth
                                            disabled={!!(loading || otp.length < 4)}
                                            sx={{ height: 56, borderRadius: 3, fontWeight: 800 }}
                                        >
                                            {loading ? <CircularProgress size={24} /> : "Verify & Start Call"}
                                        </Button>
                                        <Button variant="text" size="small" sx={{ mt: 2 }} onClick={() => setStep('lead_form')}>Back to Registration</Button>
                                    </Box>
                                </motion.div>
                            )}

                            {step === 'in_call' && (
                                <motion.div
                                    key="in_call"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
                                >
                                    <Box sx={{ position: 'relative', width: { xs: 200, md: 240 }, height: { xs: 200, md: 240 } }}>
                                        <AnimatePresence>
                                            {isConnected && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.2, 1] }}
                                                    exit={{ opacity: 0, scale: 0.8 }}
                                                    transition={{ duration: 3, repeat: Infinity }}
                                                    style={{
                                                        position: 'absolute',
                                                        inset: -30,
                                                        borderRadius: '50%',
                                                        background: `radial-gradient(circle, ${isMuted ? '#94A3B8' : theme.palette.primary.main} 0%, transparent 70%)`,
                                                        zIndex: 0
                                                    }}
                                                />
                                            )}
                                        </AnimatePresence>

                                        <Box sx={{
                                            position: 'relative',
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            background: isMuted
                                                ? 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)'
                                                : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 1,
                                            boxShadow: `0 20px 40px ${alpha(isMuted ? '#64748B' : theme.palette.primary.main, 0.2)}`,
                                            border: '6px solid #FFF',
                                            transition: 'all 0.5s ease'
                                        }}>
                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key={isConnected + String(isMuted)}
                                                    initial={{ opacity: 0, scale: 0.5 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.5 }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    {isMuted ? <MicOff size={64} color="white" /> : (isConnected ? <Mic size={64} color="white" /> : <Headphones size={64} color="white" />)}
                                                </motion.div>
                                            </AnimatePresence>
                                        </Box>
                                    </Box>

                                    <Box sx={{ mt: 3, textAlign: 'center' }}>
                                        <Typography variant="h5" sx={{ fontWeight: 800 }}>{leadForm.firstName || "Candidate"}</Typography>
                                        <Typography variant="body2" color="text.secondary">Interviewing for <b>{job}</b></Typography>
                                    </Box>

                                    <Box sx={{
                                        height: 70,
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 4,
                                        mt: 5,
                                        borderRadius: '100px',
                                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0'}`,
                                        transition: 'all 0.3s ease'
                                    }}>
                                        {[...Array(24)].map((_, i) => (
                                            <WaveformBar key={i} index={i} isPlaying={isConnected} isMuted={isMuted} />
                                        ))}
                                    </Box>

                                    <Stack direction="row" spacing={3} sx={{ mt: 5 }}>
                                        <IconButton
                                            onClick={() => setIsMuted(!isMuted)}
                                            sx={{
                                                width: 64,
                                                height: 64,
                                                bgcolor: isMuted ? 'error.main' : alpha(theme.palette.text.primary, 0.05),
                                                color: isMuted ? 'white' : 'text.primary',
                                                '&:hover': { bgcolor: isMuted ? 'error.dark' : alpha(theme.palette.text.primary, 0.1) },
                                            }}
                                        >
                                            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
                                        </IconButton>

                                        <IconButton
                                            onClick={endCall}
                                            sx={{
                                                width: 64,
                                                height: 64,
                                                bgcolor: 'error.main',
                                                color: 'white',
                                                boxShadow: `0 12px 30px ${alpha(theme.palette.error.main, 0.4)}`,
                                                '&:hover': { bgcolor: 'error.dark', transform: 'scale(1.1) rotate(90deg)' },
                                                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                            }}
                                        >
                                            <Phone size={32} style={{ transform: 'rotate(135deg)' }} />
                                        </IconButton>
                                    </Stack>
                                </motion.div>
                            )}

                            {step === 'summary' && (
                                <motion.div
                                    key="summary"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    style={{
                                        textAlign: 'center',
                                        position: 'relative',
                                        height: '100%',
                                        maxHeight: embedded ? '100%' : 'none',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <Box
                                        sx={{
                                            height: '100%',
                                            maxHeight: embedded ? { xs: 330, md: 390 } : 'none',
                                            overflowY: embedded ? 'auto' : 'visible',
                                            pr: embedded ? 1 : 0,
                                            mr: embedded ? -0.5 : 0
                                        }}
                                    >
                                        <Box sx={{ mb: 3 }}>
                                            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                                                <FileText size={40} color={theme.palette.success.main} />
                                            </Box>
                                            <Typography variant="h4" sx={{ fontWeight: 850, mb: 1 }}>Analysis Ready</Typography>
                                            <Typography color="text.secondary">The AI has analyzed your session with {leadForm.firstName}</Typography>
                                        </Box>

                                        <Stack spacing={2} sx={{ maxWidth: 500, mx: 'auto' }}>
                                            {transcriptPreview ? (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    style={{ position: 'relative' }}
                                                >
                                                    <Paper sx={{
                                                        maxHeight: embedded ? 220 : 300,
                                                        overflowY: 'auto',
                                                        p: 3,
                                                        textAlign: 'left',
                                                        borderRadius: 4,
                                                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                                        mb: 2
                                                    }}>
                                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.8 }}>
                                                            {transcriptPreview}
                                                        </Typography>
                                                    </Paper>
                                                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                                                        <Button
                                                            fullWidth
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={() => fetchSummary('transcript')}
                                                            startIcon={<Download size={14} />}
                                                        >
                                                            Download TXT
                                                        </Button>
                                                        <Button
                                                            fullWidth
                                                            variant="text"
                                                            size="small"
                                                            onClick={() => setTranscriptPreview(null)}
                                                        >
                                                            Close Preview
                                                        </Button>
                                                    </Stack>
                                                </motion.div>
                                            ) : (
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    startIcon={<ClipboardList />}
                                                    onClick={() => fetchSummary('transcript', true)}
                                                    sx={{ height: 60, borderRadius: 4, justifyContent: 'flex-start', px: 3, borderWidth: 2, borderColor: alpha(theme.palette.primary.main, 0.2), '&:hover': { borderWidth: 2 } }}
                                                >
                                                    <Box sx={{ flex: 1, textAlign: 'left' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>View Transcript</Typography>
                                                        <Typography variant="caption" color="text.secondary">Review the conversation directly in UI</Typography>
                                                    </Box>
                                                    <ChevronRight size={18} />
                                                </Button>
                                            )}

                                            {audioPreviewUrl ? (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    style={{ position: 'relative' }}
                                                >
                                                    <Paper sx={{
                                                        p: 3,
                                                        borderRadius: 4,
                                                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                                                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                                                        mb: 2,
                                                        textAlign: 'center'
                                                    }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>Session Recording</Typography>
                                                        <audio
                                                            controls
                                                            autoPlay
                                                            src={audioPreviewUrl}
                                                            style={{ width: '100%', height: '40px' }}
                                                        >
                                                            Your browser does not support the audio element.
                                                        </audio>
                                                        <Button
                                                            variant="text"
                                                            size="small"
                                                            fullWidth
                                                            sx={{ mt: 2 }}
                                                            onClick={() => setAudioPreviewUrl(null)}
                                                        >
                                                            Close Audio Player
                                                        </Button>
                                                    </Paper>
                                                </motion.div>
                                            ) : (
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    startIcon={<Radio />}
                                                    onClick={() => fetchSummary('audio', true)}
                                                    sx={{ height: 60, borderRadius: 4, justifyContent: 'flex-start', px: 3, borderWidth: 2, borderColor: alpha(theme.palette.primary.main, 0.2), '&:hover': { borderWidth: 2 } }}
                                                >
                                                    <Box sx={{ flex: 1, textAlign: 'left' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Audio Recording</Typography>
                                                        <Typography variant="caption" color="text.secondary">Listen to the session playback</Typography>
                                                    </Box>
                                                    <ChevronRight size={18} />
                                                </Button>
                                            )}

                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={<Settings size={20} />}
                                                onClick={() => alert("Detailed Excel Trackers are a premium feature. Please contact our support team at support@hirexit.com to unlock full reporting.")}
                                                sx={{
                                                    height: 60,
                                                    borderRadius: 4,
                                                    justifyContent: 'flex-start',
                                                    px: 3,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.4),
                                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.5) },
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <Box sx={{ flex: 1, textAlign: 'left' }}>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Excel Report Tracker</Typography>
                                                        <Box sx={{ bgcolor: 'secondary.main', px: 1, borderRadius: 1 }}>
                                                            <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 900, color: 'white' }}>PREMIUM</Typography>
                                                        </Box>
                                                    </Stack>
                                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Contact support to unlock detailed scoring</Typography>
                                                </Box>
                                                <ChevronRight size={18} />
                                            </Button>

                                            <Button
                                                variant="text"
                                                onClick={() => {
                                                    startedSessionRef.current = '';
                                                    setStep('welcome');
                                                    setTranscriptPreview(null);
                                                    setAudioPreviewUrl(null);
                                                }}
                                                sx={{ mt: 2, color: 'text.secondary', fontWeight: 700 }}
                                            >
                                                Start Another Demo
                                            </Button>
                                        </Stack>
                                    </Box>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Box>
                </Paper>
            </Container>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .pulse-animation {
                    animation: pulse 2s infinite ease-in-out;
                }
            `}</style>
        </Box >
    );
};

export default VoiceDemo;

