import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Checkbox, CircularProgress, FormControlLabel, Link, MenuItem, Stack, TextField, Typography, alpha, useTheme } from '@mui/material';
import { CheckCircle2 } from 'lucide-react';
import countryList from '../../../assets/CountryCodes.json';
import { getDemoCandidateId, getDemoFlowConfig } from './demoSessionConfig';
import { sendDemoLeadOtp, verifyDemoLeadOtp } from '../bookDemo/bookDemoApi';
import { getPublicDemoLeadSession, setPublicDemoLeadSession } from '../bookDemo/publicDemoLeadSession';

const DEFAULT_LEAD_FORM = {
    firstName: '',
    lastName: '',
    mobile: '',
    countryCode: '+91',
    email: '',
    company: '',
    terms: false
};

const isFreeEmail = (email) => {
    if (!email.includes('@')) {
        return false;
    }

    const freeDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return freeDomains.includes(domain);
};

const DemoLeadCaptureForm = ({ flow, open, onVerified, showDemoRole = true }) => {
    const theme = useTheme();
    const [step, setStep] = useState('lead_form');
    const [leadForm, setLeadForm] = useState(DEFAULT_LEAD_FORM);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [mode] = useState('normal');
    const autoResumeRef = useRef('');

    const flowConfig = useMemo(() => getDemoFlowConfig(flow), [flow]);

    const buildVerifiedPayload = useCallback((leadFormValue, otpResult = {}) => {
        const verifiedLead = setPublicDemoLeadSession({
            leadForm: leadFormValue,
            sourceFlow: flow,
        });
        const finalCandidateId = otpResult?.candidateId || getDemoCandidateId();
        const finalJobId = otpResult?.jobId || flowConfig.jobId;
        const baseUuid = flow === 'live-demo'
            ? `call_simulation_____${Date.now()}`
            : `interview_demo_____${Date.now()}`;
        const formattedUuid = `${baseUuid} ${verifiedLead.candidateEmail}`;

        return {
            flow,
            mode,
            demoOf: flowConfig.demoOf,
            jobTitle: flowConfig.jobTitle,
            jobId: finalJobId,
            candidateId: finalCandidateId,
            callUUID: formattedUuid,
            interviewMeta: flowConfig.interviewMeta || null,
            leadForm: {
                ...verifiedLead.leadForm
            },
            verifiedLead,
            sessionKey: `${flow}-${Date.now()}`
        };
    }, [flow, flowConfig.demoOf, flowConfig.interviewMeta, flowConfig.jobId, flowConfig.jobTitle, mode]);

    useEffect(() => {
        if (!open) {
            autoResumeRef.current = '';
            return;
        }

        setStep('lead_form');
        setLeadForm(DEFAULT_LEAD_FORM);
        setOtp('');
        setLoading(false);
        setErrorMessage('');
    }, [open, flow]);

    useEffect(() => {
        if (!open || flow === 'book-demo') {
            return;
        }

        const verifiedSession = getPublicDemoLeadSession();
        const resumeKey = `${flow}:${verifiedSession?.candidateEmail || ''}`;

        if (!verifiedSession?.candidateEmail || autoResumeRef.current === resumeKey) {
            return;
        }

        autoResumeRef.current = resumeKey;
        onVerified(buildVerifiedPayload(verifiedSession.leadForm));
    }, [buildVerifiedPayload, flow, onVerified, open]);

    const handleSendOtp = async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage('');

        try {
            await sendDemoLeadOtp({
                leadForm,
                flowConfig,
            });
            setStep('otp');
        } catch (error) {
            console.error('OTP Send Error:', error);
            setErrorMessage(error?.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage('');

        try {
            const result = await verifyDemoLeadOtp({
                leadForm,
                otp,
                flowConfig,
            });

            onVerified(buildVerifiedPayload(leadForm, result));
        } catch (error) {
            console.error('OTP Verify Error:', error);
            const message = error?.message || (typeof error === 'string' ? error : 'Invalid OTP. Please try again.');
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ px: { xs: 0.5, md: 1 }, pb: { xs: 0.5, md: 1 } }}>
            <Stack spacing={1} sx={{ mb: 2.5 }}>
                <Typography
                    sx={{
                        fontSize: { xs: '1rem', md: '1.08rem' },
                        fontWeight: 900,
                        color: 'text.primary',
                        letterSpacing: '-0.02em'
                    }}
                >
                    {flowConfig.title}
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', lineHeight: 1.7 }}>
                    {flowConfig.description}
                </Typography>
                {/* {showDemoRole && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Box
                            sx={{
                                px: 1.5,
                                py: 0.65,
                                borderRadius: 999,
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`
                            }}
                        >
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: 'primary.main' }}>
                                Demo role: {flowConfig.jobTitle}
                            </Typography>
                        </Box>
                    </Stack>
                )} */}
            </Stack>

            {step === 'lead_form' && (
                <Box component="form" onSubmit={handleSendOtp} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                        label="First Name"
                        required
                        fullWidth
                        value={leadForm.firstName}
                        onChange={(event) => setLeadForm((current) => ({ ...current, firstName: event.target.value }))}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                    <TextField
                        label="Last Name"
                        required
                        fullWidth
                        value={leadForm.lastName}
                        onChange={(event) => setLeadForm((current) => ({ ...current, lastName: event.target.value }))}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                    <TextField
                        select
                        label="Country Code"
                        required
                        fullWidth
                        value={leadForm.countryCode}
                        onChange={(event) => setLeadForm((current) => ({ ...current, countryCode: event.target.value }))}
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
                        onChange={(event) => setLeadForm((current) => ({ ...current, mobile: event.target.value }))}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                    <TextField
                        label="Business Email"
                        required
                        fullWidth
                        type="email"
                        value={leadForm.email}
                        onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))}
                        error={Boolean(leadForm.email && isFreeEmail(leadForm.email))}
                        helperText={leadForm.email && isFreeEmail(leadForm.email) ? 'Please use a business email' : ''}
                        sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                    <TextField
                        label="Company Name"
                        required
                        fullWidth
                        value={leadForm.company}
                        onChange={(event) => setLeadForm((current) => ({ ...current, company: event.target.value }))}
                        sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                    <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' } }}>
                        <FormControlLabel
                            control={(
                                <Checkbox
                                    checked={leadForm.terms}
                                    onChange={(event) => setLeadForm((current) => ({ ...current, terms: event.target.checked }))}
                                    required
                                />
                            )}
                            label={(
                                <Typography variant="caption" color="text.secondary">
                                    I accept the <Link href="/termscondition" target="_blank">Terms and Conditions</Link>
                                </Typography>
                            )}
                        />
                    </Box>

                    {errorMessage && (
                        <Typography sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, color: 'error.main', fontSize: '0.86rem' }}>
                            {errorMessage}
                        </Typography>
                    )}

                    <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={Boolean(loading || (leadForm.email && isFreeEmail(leadForm.email)))}
                        sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, height: 50, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                    >
                        {loading ? <CircularProgress size={22} /> : 'Continue to OTP'}
                    </Button>
                </Box>
            )}

            {step === 'otp' && (
                <Box component="form" onSubmit={handleVerifyOtp} sx={{ maxWidth: 360, mx: 'auto', textAlign: 'center' }}>
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                            <CheckCircle2 size={30} color={theme.palette.primary.main} />
                        </Box>
                        <Typography sx={{ fontSize: '1.04rem', fontWeight: 850, color: 'text.primary' }}>
                            Check your email
                        </Typography>
                        <Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: '0.9rem', lineHeight: 1.65 }}>
                            We sent a 6-digit OTP to {leadForm.email}. Once verified, the {flow === 'ai-interview' ? 'interview demo' : flow === 'book-demo' ? 'booking page' : 'live call'} will continue automatically.
                        </Typography>
                    </Box>

                    <TextField
                        fullWidth
                        placeholder="000000"
                        label="Verification Code"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value)}
                        inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.4rem', letterSpacing: '8px', fontWeight: 800 } }}
                        sx={{ mb: 2.2, '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
                    />

                    {errorMessage && (
                        <Typography sx={{ mb: 1.5, color: 'error.main', fontSize: '0.86rem' }}>
                            {errorMessage}
                        </Typography>
                    )}

                    <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={Boolean(loading || otp.length < 4)}
                        sx={{ height: 54, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                    >
                        {loading ? <CircularProgress size={22} /> : flowConfig.ctaLabel}
                    </Button>

                    <Button
                        variant="text"
                        size="small"
                        sx={{ mt: 1.8, fontWeight: 700, textTransform: 'none' }}
                        onClick={() => {
                            setStep('lead_form');
                            setErrorMessage('');
                        }}
                    >
                        Back to registration
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default DemoLeadCaptureForm;
