import { useMemo } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography, alpha, useTheme } from '@mui/material';
import { CalendarClock, Mail, UserRound } from 'lucide-react';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

const formatPreview = (value, timezone) => {
    const date = dayjs(value);
    if (!date.isValid()) {
        return 'Select a time';
    }

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: timezone,
    }).format(date.toDate());
};

const BookDemoScheduleStep = ({
    verifiedLead,
    scheduleDraft,
    onScheduleChange,
    onSubmit,
    onResetLead,
    loading,
    errorMessage,
}) => {
    const theme = useTheme();
    const minDateTime = useMemo(() => dayjs().add(30, 'minute').second(0), []);

    return (
        <Stack spacing={2.4}>
            <Stack spacing={1}>
                <Typography sx={{ fontSize: { xs: '1rem', md: '1.08rem' }, fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
                    Pick your demo slot
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', lineHeight: 1.7 }}>
                    Choose an exact 30-minute slot. We will assign an available product specialist and confirm the meeting instantly.
                </Typography>
            </Stack>

            <Box
                sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                }}
            >
                <Stack spacing={1.1}>
                    <Stack direction="row" spacing={1.1} alignItems="center">
                        <UserRound size={16} color={theme.palette.primary.main} />
                        <Typography sx={{ fontSize: '0.94rem', fontWeight: 800, color: 'text.primary' }}>
                            {verifiedLead?.candidateName}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.1} alignItems="center">
                        <Mail size={16} color={theme.palette.primary.main} />
                        <Typography sx={{ fontSize: '0.92rem', color: 'text.secondary' }}>
                            {verifiedLead?.candidateEmail}
                        </Typography>
                    </Stack>
                    <Button
                        variant="text"
                        size="small"
                        onClick={onResetLead}
                        sx={{ alignSelf: 'flex-start', px: 0, fontWeight: 700, textTransform: 'none' }}
                    >
                        Use different contact details
                    </Button>
                </Stack>
            </Box>

            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                    label="Meeting time"
                    value={scheduleDraft?.startAt || null}
                    onChange={(value) => onScheduleChange(value)}
                    minDateTime={minDateTime}
                    ampm
                    slotProps={{
                        textField: {
                            fullWidth: true,
                            helperText: 'All demo meetings are 30 minutes long.',
                            sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } },
                        },
                    }}
                />
            </LocalizationProvider>

            <TextField
                fullWidth
                label="Timezone"
                value={scheduleDraft?.timezone || 'UTC'}
                disabled
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />

            <Box
                sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.secondary.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.12)}`,
                }}
            >
                <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 0.75 }}>
                    <CalendarClock size={16} color={theme.palette.secondary.main} />
                    <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>
                        Preview
                    </Typography>
                </Stack>
                <Typography sx={{ fontSize: '0.92rem', color: 'text.secondary', lineHeight: 1.7 }}>
                    {formatPreview(scheduleDraft?.startAt, scheduleDraft?.timezone)}
                </Typography>
            </Box>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

            <Button
                variant="contained"
                fullWidth
                onClick={onSubmit}
                disabled={loading || !dayjs(scheduleDraft?.startAt).isValid()}
                sx={{ height: 52, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
            >
                {loading ? <CircularProgress size={22} /> : 'Schedule my demo'}
            </Button>
        </Stack>
    );
};

export default BookDemoScheduleStep;
