import React from 'react';
import {
    Box,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';

export default function BulkInterviewScheduleModal({
    open = false,
    onClose,
    title = 'Set Interview Time',
    drafts = [],
    filteredDrafts = [],
    searchValue = '',
    onSearchChange,
    onDateChange,
    onDurationChange,
    onContinue,
    continueDisabled = false,
    continueLabel = 'Continue',
    emptyMessage = 'No candidates match your search.',
}) {
    return (
        <MUIModal
            open={open}
            onClose={onClose}
            contentSx={{
                width: { xs: '95vw', md: '86vw', lg: '80vw' },
                maxWidth: '1260px',
                borderRadius: 3,
                p: { xs: 2, md: 3 },
                border: 'none',
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {title}
                </Typography>

                <Box
                    sx={{
                        display: 'flex',
                        gap: 2,
                        alignItems: { xs: 'stretch', sm: 'center' },
                        flexDirection: { xs: 'column', sm: 'row' },
                    }}
                >
                    <TextField
                        placeholder="Search candidate by name, email, or phone"
                        value={searchValue}
                        onChange={(event) => onSearchChange?.(event.target.value)}
                        size="small"
                        fullWidth
                        sx={{ flex: 1, minWidth: 240 }}
                    />
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ whiteSpace: 'nowrap' }}
                    >
                        Showing {filteredDrafts.length} of {drafts.length}
                    </Typography>
                </Box>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Box sx={{ maxHeight: '55vh', overflowY: 'auto', overflowX: 'auto', pr: 1 }}>
                        <Box sx={{ minWidth: 1120 }}>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '140px 160px 260px 140px 260px 140px',
                                    gap: 2,
                                    fontWeight: 600,
                                    color: 'text.secondary',
                                    pb: 1,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <Typography variant="caption">First Name</Typography>
                                <Typography variant="caption">Last Name</Typography>
                                <Typography variant="caption">Email</Typography>
                                <Typography variant="caption">Phone</Typography>
                                <Typography variant="caption">Interview Date & Time</Typography>
                                <Typography variant="caption">Duration</Typography>
                            </Box>

                            {filteredDrafts.map((item) => (
                                <Box
                                    key={item.id}
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: '140px 160px 260px 140px 260px 140px',
                                        columnGap: 2,
                                        alignItems: 'center',
                                        borderBottom: '1px solid',
                                        borderColor: 'divider',
                                        py: 2,
                                        '& > *': { minWidth: 0 },
                                    }}
                                >
                                    <Box>
                                        <Typography variant="body2" noWrap title={item.firstName || '-'}>
                                            {item.firstName || '-'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" noWrap title={item.lastName || '-'}>
                                            {item.lastName || '-'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" noWrap title={item.email || '-'}>
                                            {item.email || '-'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            noWrap
                                            title={item.phoneNumber || '-'}
                                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                                        >
                                            {item.phoneNumber || '-'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <DateTimePicker
                                            value={item.scheduleAt}
                                            onChange={(value) => onDateChange?.(item.id, value)}
                                            format="DD-MM-YYYY hh:mm A"
                                            slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                            sx={{ width: '100%' }}
                                        />
                                    </Box>
                                    <Box>
                                        <TextField
                                            select
                                            value={item.durationMinutes || 45}
                                            onChange={(event) =>
                                                onDurationChange?.(item.id, event.target.value)
                                            }
                                            size="small"
                                            fullWidth
                                        >
                                            <MenuItem value={30}>30 min</MenuItem>
                                            <MenuItem value={45}>45 min</MenuItem>
                                            <MenuItem value={60}>60 min</MenuItem>
                                            <MenuItem value={90}>90 min</MenuItem>
                                        </TextField>
                                    </Box>
                                </Box>
                            ))}

                            {filteredDrafts.length === 0 && (
                                <Box sx={{ py: 3 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {emptyMessage}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </LocalizationProvider>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
                    <MUIButton onClick={onContinue} disabled={continueDisabled}>
                        {continueLabel}
                    </MUIButton>
                    <MUIButton onClick={onClose}>
                        Cancel
                    </MUIButton>
                </Box>
            </Box>
        </MUIModal>
    );
}
