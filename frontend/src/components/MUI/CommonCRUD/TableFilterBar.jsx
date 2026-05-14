import React, { useState, useMemo } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Tooltip,
    Badge,
    MenuItem,
    Autocomplete,
    Typography,
    InputAdornment,
    Chip,
    CircularProgress,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import MUIModal from '../commonUI/MUIModal';
import MUIButton from '../commonUI/MUIButton';

/**
 * TableFilterBar — reusable search + filter toolbar for any table.
 *
 * Props:
 *   searchLabel            string     label on the search TextField
 *   searchValue            string     controlled raw search value
 *   onSearchChange         fn(val)    called on every keystroke
 *
 *   filterTitle            string     modal heading
 *   filterFields           array      [{ field, label, type? }]
 *                                       type = 'text' (default) | 'date'
 *
 *   rows                   array      current page rows (used only when allRows not provided)
 *   allRows                array      ALL data rows — used for building filter value options.
 *                                     Pass this for server-side paginated tables so the filter
 *                                     shows every possible value, not just the current page.
 *   getFieldValue          fn(row, field) => string
 *
 *   onFilterOpen           fn()       called when the filter button is clicked —
 *                                     use this to lazy-load allRows before the modal shows
 *   filterOptionsLoading   bool       if true, shows a spinner inside the modal
 *
 *   appliedField           string     currently applied filter field ('all' = none)
 *   appliedValue           { label, value }
 *   appliedDateFrom        string
 *   appliedDateTo          string
 *
 *   onApply   fn(field, value, dateFrom, dateTo)
 *   onClear   fn()
 *
 *   extraControls          JSX        extra buttons / toggles rendered after filter icon
 */
export default function TableFilterBar({
    searchLabel = 'Search...',
    searchValue = '',
    onSearchChange,

    filterTitle = 'Filter',
    filterFields = [],
    rows = [],
    allRows,              // all data rows for value options (overrides rows)
    getFieldValue,

    onFilterOpen,         // called when filter icon is clicked (before modal opens)
    filterOptionsLoading = false,

    appliedField = 'all',
    appliedValue = { label: 'All', value: 'all' },
    appliedDateFrom = '',
    appliedDateTo = '',

    onApply,
    onClear,

    extraControls,
}) {
    const [fltOpen, setFltOpen] = useState(false);

    // Pending (in-modal) state — only committed on Apply
    const [fltField, setFltField] = useState('all');
    const [fltValue, setFltValue] = useState({ label: 'All', value: 'all' });
    const [fltDateFrom, setFltDateFrom] = useState('');
    const [fltDateTo, setFltDateTo] = useState('');

    // ── Derived ──────────────────────────────────────────────────────────────
    const isFilterApplied =
        (appliedField === 'createdAt' && (appliedDateFrom || appliedDateTo)) ||
        (appliedField !== 'all' && appliedValue?.value !== 'all');

    const selectedFieldCfg = filterFields.find(f => f.field === fltField);
    const isDateField = selectedFieldCfg?.type === 'date';

    // Source for value options: prefer allRows (full dataset), fall back to rows (current page)
    const optionSourceRows = allRows ?? rows;

    // Compute unique value options for the selected filter field
    const valueOptions = useMemo(() => {
        if (!fltField || fltField === 'all' || isDateField) {
            return [{ label: 'All', value: 'all' }];
        }
        const resolver = getFieldValue || ((row, f) => row?.[f] ?? '');
        const uniq = Array.from(
            new Set(optionSourceRows.map(r => String(resolver(r, fltField)).trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return [{ label: 'All', value: 'all' }, ...uniq.map(v => ({ label: v, value: v }))];
    }, [fltField, optionSourceRows, getFieldValue, isDateField]);

    // Active filter label for the chip indicator
    const activeFilterLabel = useMemo(() => {
        if (!isFilterApplied) return null;
        const fieldCfg = filterFields.find(f => f.field === appliedField);
        const fieldLabel = fieldCfg?.label || appliedField;
        if (appliedField === 'createdAt') {
            const parts = [
                appliedDateFrom && `From ${appliedDateFrom}`,
                appliedDateTo && `To ${appliedDateTo}`,
            ].filter(Boolean);
            return `${fieldLabel}: ${parts.join(' ')}`;
        }
        return `${fieldLabel}: ${appliedValue?.label || appliedValue?.value}`;
    }, [isFilterApplied, appliedField, appliedValue, appliedDateFrom, appliedDateTo, filterFields]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const openFilterModal = () => {
        // Let the parent load all data for options before we open
        onFilterOpen?.();
        setFltField(appliedField);
        setFltValue(appliedValue || { label: 'All', value: 'all' });
        setFltDateFrom(appliedDateFrom);
        setFltDateTo(appliedDateTo);
        setFltOpen(true);
    };

    const handleFieldChange = (newField) => {
        setFltField(newField);
        setFltValue({ label: 'All', value: 'all' });
        setFltDateFrom('');
        setFltDateTo('');
    };

    const handleApply = () => {
        const cfgIsDate = filterFields.find(f => f.field === fltField)?.type === 'date';
        onApply?.(
            fltField,
            cfgIsDate ? { label: 'All', value: 'all' } : fltValue,
            cfgIsDate ? fltDateFrom : '',
            cfgIsDate ? fltDateTo : '',
        );
        setFltOpen(false);
    };

    const handleClear = () => {
        setFltField('all');
        setFltValue({ label: 'All', value: 'all' });
        setFltDateFrom('');
        setFltDateTo('');
        onClear?.();
        setFltOpen(false);
    };

    const handleCancel = () => {
        setFltOpen(false);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>

                {/* ── Search input ── */}
                <TextField
                    label={searchLabel}
                    variant="outlined"
                    size="small"
                    value={searchValue}
                    onChange={e => onSearchChange?.(e.target.value)}
                    sx={{ minWidth: 220 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                            </InputAdornment>
                        ),
                        endAdornment: searchValue ? (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    edge="end"
                                    onClick={() => onSearchChange?.('')}
                                    aria-label="clear search"
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    }}
                />

                {/* ── Extra controls (buttons, toggles, etc.) ── */}
                {extraControls}

                {/* ── Filter icon button ── */}
                {filterFields.length > 0 && (
                    <Tooltip title={isFilterApplied ? 'Filter active — click to edit' : 'Filter'}>
                        <IconButton
                            onClick={openFilterModal}
                            size="small"
                            sx={{ p: 1 }}
                            aria-label="open filter"
                        >
                            <Badge variant="dot" color="primary" invisible={!isFilterApplied}>
                                <FilterListIcon
                                    sx={{ color: isFilterApplied ? 'primary.main' : 'text.secondary' }}
                                />
                            </Badge>
                        </IconButton>
                    </Tooltip>
                )}

                {/* ── Active filter chip — quick-clear indicator ── */}
                {activeFilterLabel && (
                    <Chip
                        label={activeFilterLabel}
                        size="small"
                        color="primary"
                        variant="outlined"
                        onDelete={handleClear}
                        deleteIcon={<ClearIcon fontSize="small" />}
                        sx={{ maxWidth: 320, fontSize: '0.75rem' }}
                    />
                )}
            </Box>

            {/* ── Filter Modal ──────────────────────────────────────────────── */}
            <MUIModal
                open={fltOpen}
                onClose={() => setFltOpen(false)}
                contentSx={{ width: { xs: '92vw', sm: '460px' }, maxWidth: '500px' }}
            >
                {/* Header */}
                <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{filterTitle}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                            Pick a column then select or type a value to filter.
                        </Typography>
                    </Box>
                    {filterOptionsLoading && (
                        <Tooltip title="Loading all filter options...">
                            <CircularProgress size={18} sx={{ ml: 1, flexShrink: 0 }} />
                        </Tooltip>
                    )}
                </Box>

                {/* ── Field selector ── */}
                <TextField
                    label="Filter by column"
                    select
                    value={fltField}
                    onChange={e => handleFieldChange(e.target.value)}
                    fullWidth
                    size="small"
                    sx={{ mb: 2.5 }}
                >
                    <MenuItem value="all">— No filter (show all) —</MenuItem>
                    {filterFields.map(({ field, label }) => (
                        <MenuItem key={field} value={field}>{label}</MenuItem>
                    ))}
                </TextField>

                {/* ── Value input — shown only after a field is selected ── */}
                {fltField !== 'all' && (
                    isDateField ? (
                        /* Date range pickers */
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                Date range
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                                <TextField
                                    label="From"
                                    type="date"
                                    value={fltDateFrom}
                                    onChange={e => setFltDateFrom(e.target.value)}
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ flex: 1, minWidth: 140 }}
                                />
                                <TextField
                                    label="To"
                                    type="date"
                                    value={fltDateTo}
                                    onChange={e => setFltDateTo(e.target.value)}
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ flex: 1, minWidth: 140 }}
                                />
                            </Box>
                        </Box>
                    ) : (
                        /* Autocomplete — shows ALL unique values, type to search */
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                {filterOptionsLoading
                                    ? `Loading values for all records…`
                                    : `${valueOptions.length - 1} value${valueOptions.length !== 2 ? 's' : ''} available — type to search`}
                            </Typography>
                            <Autocomplete
                                disablePortal
                                options={valueOptions}
                                value={fltValue}
                                onChange={(_, v) => setFltValue(v || { label: 'All', value: 'all' })}
                                getOptionLabel={o => o?.label ?? ''}
                                isOptionEqualToValue={(o, v) => o?.value === v?.value}
                                loading={filterOptionsLoading}
                                ListboxProps={{
                                    style: {
                                        maxHeight: 260,
                                        overflow: 'auto',
                                        overscrollBehavior: 'contain',
                                    },
                                    onWheel: (event) => event.stopPropagation(),
                                    onTouchMove: (event) => event.stopPropagation(),
                                }}
                                renderInput={params => (
                                    <TextField
                                        {...params}
                                        label="Select or search value"
                                        size="small"
                                        placeholder="Type to search all options..."
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <>
                                                    <InputAdornment position="start" sx={{ ml: 0.5, mr: -0.5 }}>
                                                        <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                                                    </InputAdornment>
                                                    {params.InputProps.startAdornment}
                                                </>
                                            ),
                                            endAdornment: (
                                                <>
                                                    {filterOptionsLoading
                                                        ? <CircularProgress color="inherit" size={14} />
                                                        : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                noOptionsText={filterOptionsLoading ? 'Loading…' : 'No matching values'}
                            />
                        </Box>
                    )
                )}

                {/* ── Actions ── */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
                    <MUIButton variant="outlined" onClick={handleCancel}>
                        Cancel
                    </MUIButton>
                    <MUIButton variant="outlined" onClick={handleClear}>
                        Clear Filter
                    </MUIButton>
                    <MUIButton onClick={handleApply}>
                        Apply
                    </MUIButton>
                </Box>
            </MUIModal>
        </>
    );
}
