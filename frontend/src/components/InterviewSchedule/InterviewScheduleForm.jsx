/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    MenuItem,
    Select,
    FormControlLabel,
    Stack,
    Switch,
    Button,
    FormControl,
    InputLabel,
    Checkbox,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import LinkIcon from '@mui/icons-material/Link';
import EditNoteIcon from '@mui/icons-material/EditNote';
// import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import GridViewIcon from '@mui/icons-material/GridView';
import TuneIcon from '@mui/icons-material/Tune';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
// import CodeIcon from '@mui/icons-material/Code';

const InterviewScheduleForm = ({
    form,
    setForm,
    candidate,
    selectedCandidates = [],
    availableInterviewers,
    interviewerLabelsById,
    handleInterviewerChange,
    interviewerScheduleGroups = [],
    setCodingModalOpen,
    openParamModal,
    paramLoading,
    savedSelectedBlueprint = [],
    // onCheckDemo,
    onSchedule,
    isScheduling,
    availableLanguages = [],
    codingConfig = { allowedLanguages: [] },
    setCodingConfig = () => { },
}) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    useEffect(() => {
        if (form.interviewType === 'Coding') {
            if (
                (codingConfig.allowedLanguages || []).length === 0 &&
                availableLanguages.length > 0
            ) {
                setCodingConfig((prev) => ({
                    ...prev,
                    allowedLanguages: availableLanguages.map((l) => l.judge0Id ?? l._id),
                }));
            }
        }
    }, [form.interviewType, availableLanguages]);

    const [interviewerOpen, setInterviewerOpen] = useState(false);
    const [interviewerTypeOpen, setInterviewerTypeOpen] = useState(false);
    const isCodingInterview = form.interviewType === 'Coding';
    const interviewTypes = [
        { label: 'Tech', value: 'Technical' },
        { label: 'Non-Tech', value: 'Non-Technical' },
        { label: 'HR', value: 'HR' },
        { label: 'Psychometric', value: 'Psychometric' },
        { label: 'Coding', value: 'Coding' },
    ];
    const difficulties = ['Easy', 'Intermediate', 'Advanced'];

    const handleChange = (field, value) => {
        setForm((prev) => {
            const next = { ...prev, [field]: value };

            if (field === 'interviewType' && value === 'Coding') {
                next.interviewerType = 'AI';
                next.interviewers = [];
            }

            if (field === 'interviewerType' && value === 'AI') {
                next.interviewers = [];
            }

            return next;
        });
    };

    const getCandidateLabel = (cand) => {
        if (!cand) return "";
        const name = `${cand.firstName || ""} ${cand.lastName || ""}`.trim();
        return name || cand.email || "";
    };

    const getCandidateDisplayName = () => {
        if (Array.isArray(selectedCandidates) && selectedCandidates.length > 1) {
            const names = selectedCandidates
                .map((item) => item?.candidate || item)
                .map(getCandidateLabel)
                .filter(Boolean);

            if (names.length) return names.join(", ");
            return `${selectedCandidates.length} candidates selected`;
        }

        if (candidate) {
            return getCandidateLabel(candidate) || "Select Candidate";
        }

        if (Array.isArray(selectedCandidates) && selectedCandidates.length === 1) {
            const solo = selectedCandidates[0]?.candidate || selectedCandidates[0];
            const label = getCandidateLabel(solo);
            if (label) return label;
        }

        return "Select Candidate";
    };

    const getEndTimeLabel = () => {
        if (!form.startTime) return '';
        const [h, m] = String(form.startTime).split(':');
        const hours = Number(h);
        const minutes = Number(m);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';
        const base = new Date();
        base.setHours(hours, minutes, 0, 0);
        const duration = Number(form.durationMinutes || 0);
        if (Number.isNaN(duration)) return '';
        const end = new Date(base.getTime() + duration * 60000);
        return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const hasMultipleCandidates =
        Array.isArray(selectedCandidates) && selectedCandidates.length > 1;

    const rowSx = {
        display: 'flex',
        gap: 1.25,
        alignItems: { xs: 'flex-start', md: 'center' },
        flexDirection: { xs: 'column', sm: 'column', md: 'row' },
    };

    const labelSx = {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: { xs: '100%', md: '170px' },
        color: 'text.secondary',
    };

    const scheduleListOffsetSx = {
        ml: { xs: 0, md: '170px' },
        width: { xs: '100%', md: 'calc(100% - 170px)' },
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 1,
                    flexDirection: { xs: 'column', sm: 'row' },
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1.25rem' }}>
                    Interview Schedule
                </Typography>
                <Stack
                    direction="row"
                    spacing={0.5}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.06),
                        p: 0.5,
                        borderRadius: '8px',
                    }}
                >
                    {['Virtual', 'Phone', 'Virtual + Onsite', 'Onsite'].map((mode) => (
                        <Button
                            key={mode}
                            onClick={() => handleChange('interviewMode', mode)}
                            size="small"
                            sx={{
                                textTransform: 'none',
                                color: form.interviewMode === mode ? 'primary.main' : 'text.secondary',
                                bgcolor: form.interviewMode === mode ? 'background.paper' : 'transparent',
                                boxShadow: form.interviewMode === mode ? 1 : 'none',
                                borderRadius: '6px',
                                fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                                fontWeight: 500,
                                px: { xs: 1, sm: 1.25, md: 1.5 },
                                minWidth: 'auto',
                                '&:hover': {
                                    bgcolor: form.interviewMode === mode ? 'background.paper' : 'action.hover',
                                    color: form.interviewMode === mode ? 'primary.main' : 'text.primary',
                                },
                            }}
                        >
                            {mode}
                        </Button>
                    ))}
                </Stack>
            </Box>

            <Box sx={rowSx}>
                <Box
                    sx={{
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                        color: 'primary.main',
                        py: 0.9,
                        px: 1.6,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        minWidth: { xs: '100%', md: '170px' },
                        fontWeight: 500,
                        width: { xs: '100%', md: 'auto' },
                    }}
                >
                    <EditNoteIcon fontSize="small" />
                    Candidate Name
                </Box>
                <Box
                    sx={{
                        flex: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: '8px',
                        p: 1.2,
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                    }}
                >
                    <Typography sx={{ fontWeight: 500, color: 'text.primary' }}>
                        {getCandidateDisplayName()}
                    </Typography>
                </Box>
            </Box>

            <Box sx={rowSx}>
                <Box sx={labelSx}>
                    <GridViewIcon fontSize="small" color="action" />
                    <Typography variant="body2" fontWeight={500}>
                        Interview Category
                    </Typography>
                </Box>
                <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    flexWrap={{ xs: 'wrap', md: 'nowrap' }}
                    sx={{
                        alignItems: 'center',
                        width: '100%',
                        overflowX: { xs: 'visible', md: 'auto' }
                    }}
                >
                    {interviewTypes.map((type) => (
                        <Button
                            key={type.value}
                            onClick={() => {
                                handleChange('interviewType', type.value);
                                if (type.value === 'Coding') setCodingModalOpen(true);
                                else setCodingModalOpen(false);
                            }}
                            variant="outlined"
                            sx={{
                                textTransform: 'none',
                                color: form.interviewType === type.value ? 'primary.main' : 'text.secondary',
                                borderColor: form.interviewType === type.value ? 'primary.main' : 'divider',
                                bgcolor: form.interviewType === type.value
                                    ? alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)
                                    : 'transparent',
                                borderRadius: '8px',
                                minWidth: '70px',
                                px: 1.5,
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
                                },
                            }}
                        >
                            {type.label}
                        </Button>
                    ))}
                </Stack>
            </Box>

            {form.interviewType !== 'Coding' && (
                <Box sx={rowSx}>
                    <Box sx={labelSx}>
                        <TuneIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={500}>
                            Difficulty Level
                        </Typography>
                    </Box>
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ flex: 1, minWidth: 0, overflowX: { xs: 'visible', md: 'auto' } }}
                        useFlexGap
                        flexWrap={{ xs: 'wrap', md: 'nowrap' }}
                        alignItems="center"
                    >
                        {difficulties.map((level) => (
                            <Button
                                key={level}
                                onClick={() =>
                                    handleChange('difficultyLevel', level)
                                }
                                variant="outlined"
                                sx={{
                                    textTransform: 'none',
                                    color:
                                        form.difficultyLevel === level
                                            ? 'primary.main'
                                            : 'text.secondary',
                                    borderColor:
                                        form.difficultyLevel === level
                                            ? 'primary.main'
                                            : 'divider',
                                    bgcolor:
                                        form.difficultyLevel === level
                                            ? alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)
                                            : 'transparent',
                                    borderRadius: '8px',
                                    minWidth: '80px',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
                                    },
                                }}
                            >
                                {level}
                            </Button>
                        ))}
                        <FormControl
                            size="small"
                            sx={{ minWidth: 150, ml: 1, flexShrink: 0 }}
                        >
                            <InputLabel id="script-style-label">
                                Script Style
                            </InputLabel>
                            <Select
                                labelId="script-style-label"
                                label="Script Style"
                                value={form.scriptStyle || 'Compact'}
                                onChange={(e) =>
                                    handleChange('scriptStyle', e.target.value)
                                }
                            >
                                <MenuItem value="Compact">Compact</MenuItem>
                                <MenuItem value="Detailed">Detailed</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </Box>
            )}

            {form.interviewType === 'Coding' && (
                <Box sx={rowSx}>
                    <Box sx={labelSx}>
                        <TuneIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={500}>
                            Difficulty Level
                        </Typography>
                    </Box>
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ flex: 1, minWidth: 0, overflowX: { xs: 'visible', md: 'auto' } }}
                        useFlexGap
                        flexWrap={{ xs: 'wrap', md: 'nowrap' }}
                        alignItems="center"
                    >
                        {difficulties.map((level) => (
                            <Button
                                key={level}
                                onClick={() =>
                                    handleChange('difficultyLevel', level)
                                }
                                variant="outlined"
                                sx={{
                                    textTransform: 'none',
                                    color:
                                        form.difficultyLevel === level
                                            ? 'primary.main'
                                            : 'text.secondary',
                                    borderColor:
                                        form.difficultyLevel === level
                                            ? 'primary.main'
                                            : 'divider',
                                    bgcolor:
                                        form.difficultyLevel === level
                                            ? alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)
                                            : 'transparent',
                                    borderRadius: '8px',
                                    minWidth: '80px',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
                                    },
                                }}
                            >
                                {level}
                            </Button>
                        ))}
                        <FormControl
                            size="small"
                            sx={{ minWidth: 150, ml: 1, flexShrink: 0 }}
                        >
                            <InputLabel id="script-style-label-coding">
                                Script Style
                            </InputLabel>
                            <Select
                                labelId="script-style-label-coding"
                                label="Script Style"
                                value={form.scriptStyle || 'Compact'}
                                onChange={(e) =>
                                    handleChange('scriptStyle', e.target.value)
                                }
                            >
                                <MenuItem value="Compact">Compact</MenuItem>
                                <MenuItem value="Detailed">Detailed</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </Box>
            )}

            {!hasMultipleCandidates && (
                <Box sx={rowSx}>
                    <Box sx={labelSx}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={500}>
                            Schedule
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 1,
                            alignItems: 'center',
                            flex: 1,
                            flexWrap: { xs: 'nowrap', sm: 'wrap', md: 'nowrap' },
                            flexDirection: { xs: 'column', sm: 'row', md: 'row' },
                            width: '100%',
                        }}
                    >
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Date"
                                format="dd/MM/yyyy"
                                value={
                                    form.interviewDate
                                        ? (() => {
                                            const [y, m, d] =
                                                form.interviewDate.split('-');
                                            return new Date(+y, +m - 1, +d);
                                        })()
                                        : null
                                }
                                disablePast
                                onChange={(newValue) => {
                                    if (newValue && !isNaN(newValue.getTime())) {
                                        // Prevent jumping/artifacts by ignoring past dates (e.g. 0002, 1920)
                                        // consistently with disablePast
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        if (newValue < today) return;

                                        const year = newValue.getFullYear();
                                        const month = String(
                                            newValue.getMonth() + 1
                                        ).padStart(2, '0');
                                        const day = String(
                                            newValue.getDate()
                                        ).padStart(2, '0');
                                        handleChange(
                                            'interviewDate',
                                            `${year}-${month}-${day}`
                                        );
                                    } else if (newValue === null) {
                                        handleChange('interviewDate', '');
                                    }
                                }}
                                slotProps={{
                                    textField: {
                                        size: 'small',
                                        sx: {
                                            width: {
                                                xs: '100%',
                                                sm: '100%',
                                                md: 160,
                                                lg: 190,
                                            },
                                        },
                                    },
                                }}
                            />
                        </LocalizationProvider>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <TimePicker
                                label="Start Time"
                                value={
                                    form.startTime
                                        ? (() => {
                                            const [h, m] = form.startTime.split(':');
                                            const d = new Date();
                                            d.setHours(Number(h));
                                            d.setMinutes(Number(m));
                                            return d;
                                        })()
                                        : null
                                }
                                minTime={(() => {
                                    if (!form.interviewDate) return undefined;
                                    const selectedDate = new Date(form.interviewDate);
                                    const today = new Date();
                                    const isToday =
                                        selectedDate.getDate() === today.getDate() &&
                                        selectedDate.getMonth() === today.getMonth() &&
                                        selectedDate.getFullYear() === today.getFullYear();
                                    return isToday ? new Date() : undefined;
                                })()}
                                onChange={(newValue) => {
                                    if (newValue && !isNaN(newValue.getTime())) {
                                        const h = newValue
                                            .getHours()
                                            .toString()
                                            .padStart(2, '0');
                                        const m = newValue
                                            .getMinutes()
                                            .toString()
                                            .padStart(2, '0');
                                        handleChange('startTime', `${h}:${m}`);
                                    } else if (newValue === null) {
                                        handleChange('startTime', '');
                                    }
                                }}
                                viewRenderers={{
                                    hours: renderTimeViewClock,
                                    minutes: renderTimeViewClock,
                                    seconds: renderTimeViewClock,
                                }}
                                slotProps={{
                                    textField: {
                                        size: 'small',
                                        sx: { width: { xs: '100%', sm: '100%', md: 120 } },
                                    },
                                }}
                            />
                        </LocalizationProvider>
                        <TextField
                            disabled
                            label="End Time"
                            value={getEndTimeLabel()}
                            size="small"
                            sx={{ width: { xs: '100%', sm: '100%', md: 110 }, bgcolor: 'background.default' }}
                        />
                        <TextField
                            select
                            label="Duration"
                            value={form.durationMinutes || 45}
                            onChange={(e) => handleChange('durationMinutes', e.target.value)}
                            size="small"
                            sx={{ width: { xs: '100%', sm: '100%', md: 110 } }}
                        >
                            <MenuItem value={30}>30 min</MenuItem>
                            <MenuItem value={45}>45 min</MenuItem>
                            <MenuItem value={60}>60 min</MenuItem>
                            <MenuItem value={90}>90 min</MenuItem>
                        </TextField>
                    </Box>
                </Box>
            )}

            {form.interviewMode !== 'Onsite' && (
                <>
                    <Box sx={rowSx}>
                        <Box sx={labelSx}>
                            <LinkIcon fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={500}>
                                Meeting Link
                            </Typography>
                        </Box>
                        <TextField
                            fullWidth
                            placeholder="https://meet.google.com/..."
                            value={form.joinUrl || ''}
                            onChange={(e) => handleChange('joinUrl', e.target.value)}
                            size="small"
                        />
                    </Box>

                    <Box sx={rowSx}>
                        <Box sx={labelSx}>
                            <LocationOnOutlinedIcon fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={500}>
                                Interviewer Type
                            </Typography>
                        </Box>
                        <Select
                            fullWidth
                            size="small"
                            value={form.interviewerType || 'AI'}
                            disabled={isCodingInterview}
                            open={interviewerTypeOpen}
                            onOpen={() => {
                                if (!isCodingInterview) setInterviewerTypeOpen(true);
                            }}
                            onClose={() => setInterviewerTypeOpen(false)}
                            onChange={(e) => {
                                handleChange('interviewerType', e.target.value);
                                setInterviewerTypeOpen(false);
                            }}
                        >
                            <MenuItem value="AI">AI interviewer</MenuItem>
                            <MenuItem value="Human" disabled={isCodingInterview}>
                                Human interviewer(s)
                            </MenuItem>
                            <MenuItem value="Human+AI" disabled={isCodingInterview}>
                                Human + AI
                            </MenuItem>
                        </Select>
                    </Box>

                    {form.interviewerType !== "AI" && (
                        <Box sx={rowSx}>
                            <Box sx={labelSx}>
                                <LocationOnOutlinedIcon fontSize="small" color="action" />
                                <Typography variant="body2" fontWeight={500}>
                                    Interviewer
                                </Typography>
                            </Box>
                            <Select
                                multiple
                                value={form.interviewers || []}
                                onChange={(event) => {
                                    handleInterviewerChange(event);
                                    setInterviewerOpen(false);
                                }}
                                fullWidth
                                size="small"
                                displayEmpty
                                open={interviewerOpen}
                                onOpen={() => setInterviewerOpen(true)}
                                onClose={() => setInterviewerOpen(false)}
                                renderValue={(selected) => {
                                    if (!Array.isArray(selected) || selected.length === 0)
                                        return 'Select Interviewer';
                                    return selected.map((id) => interviewerLabelsById[id] || id).join(', ');
                                }}
                            >
                                {availableInterviewers.map((interviewer) => (
                                    <MenuItem key={interviewer._id} value={String(interviewer._id)}>
                                        {interviewer.firstName} {interviewer.lastName} ({interviewer.email})
                                    </MenuItem>
                                ))}
                            </Select>
                        </Box>
                    )}

                    {form.interviewerType !== "AI" && Array.isArray(interviewerScheduleGroups) && interviewerScheduleGroups.length > 0 && (
                        <Box sx={scheduleListOffsetSx}>
                            {interviewerScheduleGroups.map((group) => (
                                <Box
                                    key={group.interviewerId}
                                    sx={{
                                        mt: 1,
                                        p: 1.25,
                                        borderRadius: 2,
                                        bgcolor: 'background.default',
                                        border: 1,
                                        borderColor: 'divider',
                                    }}
                                >
                                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                        {group.interviewerName}
                                    </Typography>
                                    {group.interviews.length ? (
                                        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {group.interviews.map((item) => (
                                                <Box
                                                    key={item.id}
                                                    sx={{
                                                        p: 1,
                                                        borderRadius: 1,
                                                        bgcolor: 'background.paper',
                                                        border: 1,
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: 'text.primary', display: 'block' }}>
                                                        {item.when || 'Scheduled interview'}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                        {item.candidateName} - {item.jobTitle}
                                                    </Typography>
                                                    {item.isConflict && (
                                                        <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                                                            Conflicts with the selected time
                                                        </Typography>
                                                    )}
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                                            No upcoming interviews scheduled.
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Box>
                    )}

                    <Box sx={rowSx}>
                        <Box sx={labelSx}>
                            <NoteAltOutlinedIcon fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={500}>
                                Any Note
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flex: 1, flexWrap: 'wrap' }}>
                            <TextField
                                fullWidth
                                placeholder="Add Description"
                                value={form.description || ''}
                                onChange={(e) => handleChange('description', e.target.value)}
                                size="small"
                                sx={{ flex: 1, minWidth: 220 }}
                            />
                            {form.interviewType !== 'Coding' && (form.interviewerType || 'AI') === 'AI' && (
                                <Button
                                    variant="outlined"
                                    onClick={openParamModal}
                                    disabled={paramLoading}
                                    sx={{
                                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                                        color: 'primary.main',
                                        textTransform: 'none',
                                        boxShadow: 'none',
                                        whiteSpace: 'nowrap',
                                        height: '40px',
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12) },
                                    }}
                                >
                                    {paramLoading
                                        ? 'Loading Parameters...'
                                        : Array.isArray(savedSelectedBlueprint) && savedSelectedBlueprint.length
                                            ? 'Edit Parameters'
                                            : 'Configure Parameters'}
                                </Button>
                            )}
                        </Box>
                    </Box>
                </>
            )}

            {form.interviewMode === 'Onsite' && (
                <Box sx={rowSx}>
                    <Box sx={labelSx}>
                        <LocationOnOutlinedIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={500}>
                            Location
                        </Typography>
                    </Box>
                    <TextField
                        fullWidth
                        placeholder="Enter Office Address / Location"
                        value={form.locationAddress || ''}
                        onChange={(e) => handleChange('locationAddress', e.target.value)}
                        size="small"
                        sx={{ flex: 1 }}
                    />
                </Box>
            )}

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    pt: 0.5,
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 0 },
                }}
            >
                {/* <FormControlLabel
                    control={
                        <Switch
                            checked={form.sendReminder || false}
                            onChange={(e) => handleChange('sendReminder', e.target.checked)}
                            color="primary"
                        />
                    }
                    label={<Typography variant="body2" fontWeight={500}>Set Reminder</Typography>}
                /> */}

                <Box
                    sx={{
                        display: 'flex',
                        gap: 1,
                        flexWrap: 'wrap',
                        width: { xs: '100%', sm: 'auto' },
                        justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                    }}
                >
                    {/* <Button
                        variant="contained"
                        onClick={onCheckDemo}
                        sx={{
                            textTransform: 'none',
                            borderRadius: '8px',
                            px: 4,
                            width: { xs: '100%', sm: 'auto' },
                        }}
                    >
                        Check Demo
                    </Button> */}
                    <Button
                        variant="outlined"
                        onClick={onSchedule}
                        disabled={isScheduling}
                        sx={{
                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                            color: 'primary.main',
                            textTransform: 'none',
                            borderRadius: '8px',
                            px: 4,
                            boxShadow: 'none',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12) },
                            width: { xs: '100%', sm: 'auto' },
                        }}
                    >
                        {isScheduling ? 'Scheduling...' : 'Schedule'}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default InterviewScheduleForm;
