import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import { fetchData } from '../../AppUtils/dataAPI';

const FALLBACK_REASONS = [
    'I receive too many emails',
    'The emails are not relevant to me',
    'I no longer use this service',
    'I did not sign up for these emails',
    'Other',
];

const getTokenFromLocation = () => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return String(params.get('token') || '').trim();
};

export default function EmailUnsubscribe() {
    const token = useMemo(() => getTokenFromLocation(), []);
    const [preview, setPreview] = useState(null);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const reasonOptions = preview?.reasons?.length ? preview.reasons : FALLBACK_REASONS;

    useEffect(() => {
        const loadPreview = async () => {
            if (!token) {
                setError('This unsubscribe link is missing a valid token.');
                setLoading(false);
                return;
            }

            try {
                const data = await fetchData(`/api/email-unsubscribe/preview?token=${encodeURIComponent(token)}`);
                setPreview(data || null);
                setReason(String(data?.reason || ''));
            } catch (err) {
                setError(String(err?.error || err?.message || 'Unable to load unsubscribe details'));
            } finally {
                setLoading(false);
            }
        };

        loadPreview();
    }, [token]);

    const onUnsubscribe = async () => {
        setError('');
        setSuccess('');

        if (!token) {
            setError('This unsubscribe link is invalid.');
            return;
        }

        if (!reason) {
            setError('Please select a reason before unsubscribing.');
            return;
        }

        try {
            setSubmitting(true);
            const data = await fetchData('/api/email-unsubscribe', {
                method: 'POST',
                body: { token, reason },
            });

            setSuccess(`You have been unsubscribed successfully${data?.emailMasked ? ` (${data.emailMasked})` : ''}.`);
            setPreview((prev) => ({ ...(prev || {}), unsubscribed: true, reason }));
        } catch (err) {
            setError(String(err?.error || err?.message || 'Failed to unsubscribe'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Card elevation={2}>
                <CardContent>
                    <Stack spacing={2.5}>
                        <Box>
                            <Typography variant="h5" fontWeight={700} gutterBottom>
                                Unsubscribe from our mailing list
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                To help us improve our services, we would be grateful if you could tell us why:
                            </Typography>
                        </Box>

                        {loading && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <CircularProgress size={22} />
                                <Typography variant="body2">Loading unsubscribe details...</Typography>
                            </Box>
                        )}

                        {!loading && preview?.emailMasked && (
                            <Alert severity="info">Email: {preview.emailMasked}</Alert>
                        )}

                        {!loading && preview?.unsubscribed && (
                            <Alert severity="success">
                                This email is already unsubscribed. You can still submit a reason below to update your preference.
                            </Alert>
                        )}

                        {!!error && <Alert severity="error">{error}</Alert>}
                        {!!success && <Alert severity="success">{success}</Alert>}

                        <FormControl fullWidth disabled={loading || submitting}>
                            <InputLabel id="unsubscribe-reason-label">Reason</InputLabel>
                            <Select
                                labelId="unsubscribe-reason-label"
                                value={reason}
                                label="Reason"
                                onChange={(event) => setReason(String(event.target.value || ''))}
                            >
                                {reasonOptions.map((item) => (
                                    <MenuItem key={item} value={item}>
                                        {item}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box>
                            <Button
                                variant="contained"
                                color="error"
                                disabled={loading || submitting || !reason}
                                onClick={onUnsubscribe}
                            >
                                {submitting ? 'Unsubscribing...' : 'Unsubscribe'}
                            </Button>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>
        </Container>
    );
}
