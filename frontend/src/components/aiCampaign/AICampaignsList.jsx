/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    Box,
    TextField,
    FormControlLabel,
    Switch,
    Typography,
    Tooltip,
    IconButton,
    MenuItem,
    Autocomplete,
    Container,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import FilterListIcon from '@mui/icons-material/FilterList';

import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import MUIModal from '../MUI/commonUI/MUIModal';
import { useAICampaignContextState } from '../../contexts/AICampaignContext';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';

export default function AICampaignsList() {
    const navigate = useNavigate();
    const [campaignState, setCampaignState] = useAICampaignContextState();
    const [authState] = useAuthContextState();
    const [, setUiState] = useUiContextState();

    const [current, setCurrent] = useState(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [viewMode, setViewMode] = useState('me');

    const [alertCfg, setAlertCfg] = useState({
        open: false,
        message: '',
        severity: 'info'
    });
    const closeAlert = (_e, r) =>
        r !== 'clickaway' && setAlertCfg(a => ({ ...a, open: false }));

    const [fltOpen, setFltOpen] = useState(false);
    const [fltField, setFltField] = useState('all');
    const [fltValue, setFltValue] = useState({ label: 'All', value: 'all' });
    const [valueOptions, setValueOptions] = useState([{ label: 'All', value: 'all' }]);

    const [fltDateFrom, setFltDateFrom] = useState('');
    const [fltDateTo, setFltDateTo] = useState('');
    const [appliedField, setAppliedField] = useState('all');
    const [appliedValue, setAppliedValue] = useState({ label: 'All', value: 'all' });
    const [appliedDateFrom, setAppliedDateFrom] = useState('');
    const [appliedDateTo, setAppliedDateTo] = useState('');

    const columns = [
        { field: 'sno', headerName: 'No.', maxWidth: 70, flex: 1, flexGrow: 1, headerAlign: 'center' },
        { field: 'name', headerName: 'Title', minWidth: 180, flex: 1, flexGrow: 1, headerAlign: 'center' },
        { field: 'jobNames', headerName: 'Jobs', minWidth: 220, flex: 1, flexGrow: 1, headerAlign: 'center' },
        { field: 'scheduleTime', headerName: 'Scheduled Time', minWidth: 220, type: 'dateTime', flex: 1, flexGrow: 1, headerAlign: 'center' },
        { field: 'campStatus', headerName: 'Status', minWidth: 150, flex: 1, flexGrow: 1, headerAlign: 'center' },
        { field: 'createdBy', headerName: 'Created By', minWidth: 180, flex: 1, flexGrow: 1, headerAlign: 'center' },
    ];

    const loadData = (view = 'me') => {
        setUiState({ loadingMsg: 'Loading, Please wait...' });

        fetchData('/api/campaigns/?viewMode=' + view)
            .then(list => {
                const safe = Array.isArray(list) ? list : [];
                // console.log("Here is list of campaign in Frontend::", safe);

                setCampaignState({
                    aICampaignListRows: safe.map((c, idx) => {
                        const jobNames = Array.isArray(c.items)
                            ? Array.from(new Set(c.items.map(item => item.jobName).filter(Boolean))).join(', ')
                            : '';
                        return {
                            ...c,
                            items: c.items,
                            jobNames,
                            sno: idx + 1,
                            id: c._id || c.id + String(idx),
                            scheduleTime: c.scheduleTime ? new Date(c.scheduleTime) : null,
                            campStatus: c.campStatus || '—',
                            createdBy: c.createdBy || '—',
                            createdAt: c.createdAt?.substring(0, 10) || '',
                        };
                    }),
                    aICampaignsListViewMode: view /* ★ UPDATED */
                });
            })
            .catch(err => {
                console.error(err);
                setAlertCfg({
                    open: true,
                    message: 'Failed to load campaigns',
                    severity: 'error'
                });
            })
            .finally(() => setUiState({ loadingMsg: null }));
    };

    useEffect(() => {

        if (!campaignState?.aICampaignListRows || campaignState.aICampaignsListViewMode !== viewMode) { 
            loadData(viewMode);
        }
    }, [campaignState?.aICampaignListRows, viewMode]); 

    const computeValueOptions = field => {
        if (field === 'all' || field === 'createdAt') {
            setValueOptions([{ label: 'All', value: 'all' }]);
            setFltValue({ label: 'All', value: 'all' });
            return;
        }
        const key = field;
        const src = campaignState.aICampaignListRows || [];
        let uniq = Array.from(
            new Set(src.map(r => (r?.[key] ?? '').toString().trim()).filter(Boolean))
        );

        uniq = uniq.sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );

        const opts = [{ label: 'All', value: 'all' }, ...uniq.map(v => ({ label: v, value: v }))];
        setValueOptions(opts);
        const found = opts.find(o => o.value === fltValue.value) || opts[0];
        setFltValue(found);
    };

    const openFilterModal = () => {
        setFltField(appliedField);
        setFltValue(appliedValue);
        setFltDateFrom(appliedDateFrom);
        setFltDateTo(appliedDateTo);
        computeValueOptions(appliedField);
        setFltOpen(true);
    };

    const filteredRows = useMemo(() => {
        let list = campaignState.aICampaignListRows;

        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            list = list.filter(
                r =>
                    r.name?.toLowerCase().includes(q) ||
                    r.campStatus?.toLowerCase().includes(q) ||
                    r.createdBy?.toLowerCase().includes(q)
            );
        }

        if (appliedField === 'createdAt' && (appliedDateFrom || appliedDateTo)) {
            list = list.filter(r => {
                const d = r.createdAt;
                if (!d) return false;
                if (appliedDateFrom && d < appliedDateFrom) return false;
                if (appliedDateTo && d > appliedDateTo) return false;
                return true;
            });
        }
        else if (appliedField !== 'all' && appliedValue?.value !== 'all') {
            const fv = String(appliedValue.value).toLowerCase();
            list = list.filter(r =>
                String(r?.[appliedField] ?? '').toLowerCase() === fv
            );
        }

        return list;
    }, [campaignState.aICampaignListRows, viewMode, searchText,
        appliedField, appliedValue, appliedDateFrom, appliedDateTo]);

    const isFilterApplied =
        (appliedField === 'createdAt' && (appliedDateFrom || appliedDateTo)) ||
        (appliedField !== 'all' && appliedValue?.value !== 'all');

    const handleViewModeToggle = e => {
        const newView = e.target.checked ? 'all' : 'me';
        setViewMode(newView);
        loadData(newView);
    };

    const deleteRow = async () => {
        if (!current) return;
        try {
            setUiState({ loadingMsg: 'Loading, Please wait...' });
            await fetchData(`/api/campaigns/${current._id}`, { method: 'DELETE' });
            setAlertCfg({ open: true, message: 'Campaign archived', severity: 'success' });
            loadData(viewMode);
        } catch (err) {
            console.error(err);
            setAlertCfg({ open: true, message: 'Delete failed', severity: 'error' });
        } finally {
            setUiState({ loadingMsg: null });
        }
        setDeleteOpen(false);
    };

    return (
        <Container maxWidth="xl">
            <Card sx={{ m: 1, p: 2 }}>
                <CardContent>
                    <MUIAlert {...alertCfg} onClose={closeAlert} />

                    <MUIRetrieveDataGrid
                        title="AI Campaigns"
                        rows={filteredRows}
                        columns={columns}
                        onRowClick={row => navigate(`/aicampaigns/${row.id}`)}
                        onDelete={row => { setCurrent(row); setDeleteOpen(true); }}
                        createButton={
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                                <TextField
                                    size="small"
                                    label="Search campaigns"
                                    placeholder="Search by title, status or creator"
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                />
                                <FormControlLabel
                                    control={
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <Typography>My</Typography>
                                            <Switch
                                                checked={viewMode === 'all'}
                                                onChange={handleViewModeToggle}
                                            />
                                            <Typography sx={{ mr: 1 }}>All</Typography>
                                        </Box>
                                    }
                                    label="Campaigns"
                                    sx={{ borderBottom: 1, mx: 1 }}
                                />
                                {authState.user?.role !== 'ultra_admin' && (
                                    <MUIButton onClick={() => navigate('/aicampaigns/new/')} sx={{ whiteSpace: 'nowrap' }}>
                                        <CampaignIcon sx={{ mr: 1 }} />
                                        New Campaign
                                    </MUIButton>
                                )}

                                <Tooltip title="Filter">
                                    <IconButton onClick={openFilterModal}>
                                        <FilterListIcon sx={{ color: isFilterApplied ? 'primary.main' : 'inherit' }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        }
                    />

                    <MUIArchiveCnfModal
                        open={deleteOpen}
                        onClose={() => setDeleteOpen(false)}
                        onConfirm={deleteRow}
                        itemName={current?.name}
                    />

                    <MUIModal open={fltOpen} onClose={() => setFltOpen(false)}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6">Filter Campaigns</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Choose a column or a date range. Defaults are <b>All</b>.
                            </Typography>
                        </Box>

                        <TextField
                            label="Filter by"
                            select
                            value={fltField}
                            onChange={e => { const v = e.target.value; setFltField(v); computeValueOptions(v); }}
                            fullWidth
                            sx={{ mb: 2 }}
                            size="small"
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="name">Title</MenuItem>
                            <MenuItem value="campStatus">Status</MenuItem>
                            <MenuItem value="createdBy">Created By</MenuItem>
                            <MenuItem value="createdAt">Created Date</MenuItem>
                        </TextField>

                        {fltField === 'createdAt' ? (
                            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                                <TextField
                                    label="From"
                                    type="date"
                                    value={fltDateFrom}
                                    onChange={e => setFltDateFrom(e.target.value)}
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    label="To"
                                    type="date"
                                    value={fltDateTo}
                                    onChange={e => setFltDateTo(e.target.value)}
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Box>
                        ) : (
                            <Autocomplete
                                options={valueOptions}
                                value={fltValue}
                                onChange={(_, v) => setFltValue(v || { label: 'All', value: 'all' })}
                                getOptionLabel={o => o?.label ?? ''}
                                isOptionEqualToValue={(o, v) => o.value === v.value}
                                renderInput={p => <TextField {...p} label="Value" size="small" />}
                                sx={{ mb: 2 }}
                            />
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                            <MUIButton
                                color="dark"
                                variant="outlined"
                                onClick={() => {
                                    setFltField(appliedField);
                                    setFltValue(appliedValue);
                                    setFltDateFrom(appliedDateFrom);
                                    setFltDateTo(appliedDateTo);
                                    setFltOpen(false);
                                }}
                            >
                                Cancel
                            </MUIButton>

                            <MUIButton
                                onClick={() => {
                                    setFltField('all');
                                    setFltValue({ label: 'All', value: 'all' });
                                    setFltDateFrom('');
                                    setFltDateTo('');
                                    setValueOptions([{ label: 'All', value: 'all' }]);
                                    setAppliedField('all');
                                    setAppliedValue({ label: 'All', value: 'all' });
                                    setAppliedDateFrom('');
                                    setAppliedDateTo('');
                                    setFltOpen(false);
                                }}
                            >
                                Clear
                            </MUIButton>

                            <MUIButton
                                onClick={() => {
                                    setAppliedField(fltField);
                                    setAppliedValue(fltValue);
                                    setAppliedDateFrom(fltField === 'createdAt' ? fltDateFrom : '');
                                    setAppliedDateTo(fltField === 'createdAt' ? fltDateTo : '');
                                    setFltOpen(false);
                                }}
                            >
                                Apply
                            </MUIButton>
                        </Box>
                    </MUIModal>
                </CardContent>
            </Card>
        </Container>
    );
}
