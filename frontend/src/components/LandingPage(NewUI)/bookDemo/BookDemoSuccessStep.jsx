import { Box, Button, Link, Stack, Typography, alpha, useTheme } from '@mui/material';
import { CalendarCheck2, Link2, Mail, UserRound } from 'lucide-react';

const formatMeetingTime = (startTime, endTime, timezone) => {
    if (!startTime || !endTime) {
        return '';
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: timezone,
    }).format(start) + ' - ' + new Intl.DateTimeFormat('en-US', {
        timeStyle: 'short',
        timeZone: timezone,
    }).format(end);
};

const BookDemoSuccessStep = ({ result, timezone, onBookAnother, onResetLead }) => {
    const theme = useTheme();

    return (
        <Stack spacing={2.4}>
            <Stack spacing={1}>
                <Box
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(theme.palette.success.main, 0.12),
                        color: theme.palette.success.main,
                    }}
                >
                    <CalendarCheck2 size={32} />
                </Box>
                <Typography sx={{ fontSize: { xs: '1rem', md: '1.08rem' }, fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
                    Demo booked successfully
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', lineHeight: 1.7 }}>
                    Your product walkthrough is scheduled. We have already assigned a team member for the selected slot.
                </Typography>
            </Stack>

            <Box
                sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.success.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.success.main, 0.14)}`,
                }}
            >
                <Stack spacing={1.15}>
                    <Stack direction="row" spacing={1.1} alignItems="center">
                        <UserRound size={16} color={theme.palette.success.main} />
                        <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>
                            {result?.assignedMember?.name || 'Assigned host'}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.1} alignItems="center">
                        <Mail size={16} color={theme.palette.success.main} />
                        <Typography sx={{ color: 'text.secondary' }}>
                            {result?.assignedMember?.email || result?.organizerEmail}
                        </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.92rem', color: 'text.secondary', lineHeight: 1.7 }}>
                        {formatMeetingTime(result?.startTime, result?.endTime, timezone)}
                    </Typography>
                </Stack>
            </Box>

            {result?.joinUrl ? (
                <Box
                    sx={{
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                    }}
                >
                    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 0.8 }}>
                        <Link2 size={16} color={theme.palette.primary.main} />
                        <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>
                            Join link
                        </Typography>
                    </Stack>
                    <Link href={result.joinUrl} target="_blank" rel="noreferrer" sx={{ wordBreak: 'break-all' }}>
                        {result.joinUrl}
                    </Link>
                </Box>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={onBookAnother}
                    sx={{ height: 50, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                >
                    Book another demo
                </Button>
                <Button
                    variant="outlined"
                    fullWidth
                    onClick={onResetLead}
                    sx={{ height: 50, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                >
                    Change contact details
                </Button>
            </Stack>
        </Stack>
    );
};

export default BookDemoSuccessStep;
