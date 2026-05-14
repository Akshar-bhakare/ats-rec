import React, { useEffect, useState } from 'react';
import {
    Box, TextField, Checkbox,
    FormControlLabel, Typography, Paper, Divider,
    Autocomplete,
    Switch,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import MUIAlert from '../MUI/commonUI/MUIAlert';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import { useAICampaignContextState } from '../../contexts/AICampaignContext';
import { useUiContextState } from '../../contexts/UiContext';
import { fetchData } from '../../AppUtils/dataAPI';

export default function NewAICampaign() {
    const [campaignState, setCampaignState] = useAICampaignContextState();
    const [, setUiState] = useUiContextState();
    const editing = Boolean(campaignState?.campaignInitialValuesDict?._id);
    const existing = campaignState?.campaignInitialValuesDict || {};
    const nav = useNavigate();

    const [saving, setSaving] = useState(false);
    const [jobs, setJobs] = useState([]);
    const [cands, setCands] = useState([]);
    const [checks, setChecks] = useState([]);
    const [alertCfg, setAlertCfg] = useState({ open: false, message: '', severity: 'info' });
    const [data, setData] = useState({
        title: existing.name || '',
        jobId: existing.items?.[0]?.jobId || '',
        scheduleAt: existing.scheduleTime
            ? dayjs(existing.scheduleTime)
            : dayjs().add(5, 'minute')
    });
    const [viewMode, setViewMode] = useState('me');
    const [jobsViewMode, setJobsViewMode] = useState('me');

    const closeAlert = (_e, r) => r !== 'clickaway' && setAlertCfg(a => ({ ...a, open: false }));
    const setField = k => v => setData(p => ({ ...p, [k]: v }));

    useEffect(() => {
        setUiState({ loadingMsg: "Loading, Please wait..." });
        fetchData('/api/jobs?fields=title,internalTitle' + (jobsViewMode ? '&viewMode=' + jobsViewMode : ''))
            .then(arr => {
                const list = Array.isArray(arr) ? arr : [];
                list.sort((a, b) =>
                    (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
                );
                setJobs(list);
            })
            .catch(console.error)
            .finally(() => setUiState({ loadingMsg: null }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const extractJobId = cand => {
        if (Array.isArray(cand.jobs) && cand.jobs.length) {
            const j = cand.jobs[0];
            return typeof j === 'object' ? (j._id || j.$oid || j.toString()) : j;
        }
        if (cand.job) {
            return typeof cand.job === 'object' ? (cand.job._id || cand.job.$oid || cand.job.toString()) : cand.job;
        }
        return null;
    };

    useEffect(() => {
        setUiState({ loadingMsg: "Loading, Please wait..." });
        const base = '/api/candidates?fields=_id,jobs,firstName,lastName,phoneNumber,email,aiCallStatus' + (viewMode ? '&viewMode=' + viewMode : '');
        fetchData(base)
            .then(arr => {
                const list = Array.isArray(arr) ? arr : [];

                const filtered = data.jobId === 'all'
                    ? list
                    : list.filter(c => {
                        if (!Array.isArray(c.jobs)) return false;
                        return c.jobs.some(j => {
                            const jId = typeof j === 'object' ? (j._id || j.$oid || j.toString()) : j;
                            return jId && jId.toString() === data.jobId;
                        });
                    });

                setCands(filtered);
                setChecks([]);
            })
            .catch(console.error)
            .finally(() => setUiState({ loadingMsg: null }));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.jobId, viewMode]);

    const saveToServer = async () => {
        if (!checks.length) {
            setAlertCfg({ open: true, message: 'Select at least one candidate.', severity: 'warning' });
            return;
        }
        setSaving(true);
        try {
            const isoTime = data.scheduleAt ? dayjs(data.scheduleAt).toISOString() : null;
            let dtObj = new Date(isoTime).getTime();
            if (dtObj <= new Date().getTime()) {
                setAlertCfg({ open: true, message: 'Invalid date-time combination, for scheduling AI Call(s)...', severity: 'error' });
                setSaving(false);
                return;
            }

            const selCands = cands.filter(c => checks.includes(c._id));
            const items = selCands.map(c => ({
                candidateId: c._id,
                jobId: data.jobId === 'all' ? extractJobId(c) : data.jobId
            })).filter(itm => !!itm.jobId);

            if (!items.length) {
                setAlertCfg({ open: true, message: 'No valid jobId found for selected candidates.', severity: 'error' });
                setSaving(false);
                return;
            }

            setUiState({ loadingMsg: "Loading, Please wait..." });

            await fetchData(
                editing ? `/api/campaigns/${existing._id}` : '/api/campaigns',
                {
                    method: editing ? 'PUT' : 'POST',
                    body: JSON.stringify({ name: data.title, scheduleTime: isoTime, items })
                }
            );

            setUiState({ loadingMsg: null });

            setAlertCfg({ open: true, message: editing ? 'Campaign updated.' : 'Campaign created.', severity: 'success' });
            setCampaignState({ campaignInitialValuesDict: null, aICampaignListRows: null });
            nav('/aicampaigns/');
        } catch (err) {
            let msg = err?.message || 'Save failed';
            const colon = msg.indexOf(':');
            if (colon !== -1) msg = msg.slice(colon + 1).trim();
            setAlertCfg({ open: true, message: msg, severity: 'error' });
            console.error(err);
        } finally { setSaving(false); }
    };

    const allChecked = cands.length && checks.length === cands.length;
    const someChecked = checks.length && checks.length < cands.length;
    const toggleAll = () => setChecks(allChecked ? [] : cands.map(c => c._id));

    const jobOptions = [
        ...jobs.map(j => ({
            label: `${j.title}${j.internalTitle ? ` (${j.internalTitle})` : ''}`,
            value: j._id
        }))
    ];
    const selectedJob = jobOptions.find(o => o.value === data.jobId) || null;

    const Body = (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
                size='small'
                fullWidth label="Campaign Title"
                value={data.title}
                onChange={e => setField('title')(e.target.value)}
                required="true"
            />

            <Box sx={{ display: 'flex', justifyContent: "space-evenly", gap: 2 }}>
                <Autocomplete
                    fullWidth
                    freeSolo
                    size='small'
                    options={jobOptions}
                    value={selectedJob}
                    onChange={(_, v) => setField('jobId')(v ? v.value : '')}
                    getOptionLabel={o => (typeof o === 'string' ? o : o.label)}
                    isOptionEqualToValue={(o, v) => o.value === v.value}
                    renderInput={params => (
                        <TextField {...params} label="Job Filter" required="true" />
                    )}
                />

                <FormControlLabel
                    key="jobsViewModeButton"
                    control={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography>My</Typography>
                            <Switch
                                checked={!jobsViewMode}
                                onChange={() => setJobsViewMode(jobsViewMode ? null : 'me')}
                            />
                            <Typography>All</Typography>
                        </Box>
                    }
                    // label="Job(s)"
                    sx={{ mx: "auto" }}
                />

            </Box>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="subtitle2">Select Candidate(s) *</Typography>
                    <Box sx={{ display: 'flex', flexWrap: "wrap", justifyContent: 'space-evenly', gap: 2, alignItems: 'center' }}>

                        <FormControlLabel
                            key="ViewModeButton"
                            control={
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography>My</Typography>
                                    <Switch
                                        checked={!viewMode}
                                        onChange={() => setViewMode(viewMode ? null : 'me')}
                                    />
                                    <Typography>All</Typography>
                                </Box>
                            }
                            // label="Candidate(s)"
                            sx={{ mx: 1 }}
                        />

                    </Box>
                </Box>

                <Divider sx={{ mt: 2 }} />

                {cands.length === 0 ? (
                    <Typography color="text.secondary">
                        No candidates found for the chosen filter.
                    </Typography>
                ) : (<>
                    {cands.length > 5 && <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: '36px 200px 240px 160px 1fr',
                        columnGap: 1, rowGap: 1, maxHeight: 280, overflowY: 'auto', alignItems: "center", py: 2
                    }}>
                        <>

                            <Checkbox
                                size="small"
                                indeterminate={someChecked}
                                checked={allChecked}
                                onChange={toggleAll}
                            />
                            {['Name', 'Email', 'Phone', 'AI Call Status'].map(h => (
                                <Typography key={h} variant="subtitle" align='center' sx={{ fontWeight: 600 }}>
                                    {h}
                                </Typography>
                            ))}
                        </>
                    </Box>}

                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: '36px 200px 240px 160px 1fr',
                        columnGap: 1, rowGap: 1, maxHeight: 280, overflowY: 'auto', alignItems: "center", py: 2
                    }}>
                        {cands.length <= 5 && <>

                            <Checkbox
                                size="small"
                                indeterminate={someChecked}
                                checked={allChecked}
                                onChange={toggleAll}
                            />
                            {['Name', 'Email', 'Phone', 'AI Call Status'].map(h => (
                                <Typography key={h} variant="subtitle" align='center' sx={{ fontWeight: 600 }}>
                                    {h}
                                </Typography>
                            ))}
                        </>}

                        {cands.map(c => {
                            const checked = checks.includes(c._id);
                            return (
                                <React.Fragment key={c._id}>
                                    <Checkbox
                                        size="small"
                                        checked={checked}
                                        onChange={() =>
                                            setChecks(ids =>
                                                checked ? ids.filter(id => id !== c._id) : [...ids, c._id]
                                            )
                                        }
                                    />
                                    <Typography variant="body2" align='center'>{`${c.firstName || ''} ${c.lastName || ''}`}</Typography>
                                    <Typography variant="body2" align='center'>{c.email || '—'}</Typography>
                                    <Typography variant="body2" align='center'>{c.phoneNumber || '—'}</Typography>
                                    <Typography variant="body2" align='center'>{c?.aiCallStatus || '—'}</Typography>
                                </React.Fragment>
                            );
                        })}
                    </Box>
                </>
                )}
            </Paper>

            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                    label="Schedule Date & Time *"
                    value={data.scheduleAt}
                    onChange={val => setField('scheduleAt')(val)}
                    format="DD/MM/YYYY HH:mm"
                    sx={{ width: '100%' }}
                />
            </LocalizationProvider>
        </Box>
    );

    return (
        <MUICenterLayout>
            <MUIAlert {...alertCfg} onClose={closeAlert} />

            <MUICreateForm
                initialValuesDict={data}
                fields={[
                    {
                        type: 'label',
                        variant: 'h4',
                        value: editing ? 'Edit Campaign' : 'New Campaign',
                        align: 'center',
                        sx: { py: 3 }
                    },
                    { getField: () => <Box>{Body}</Box> },
                    {
                        type: "submit",
                        label: editing ? 'Update' : 'Create',
                        disabled: saving,
                    }
                ]}
                submitUrl={null}
                submitMethod={null}
                isSubmitting={saving}
                backUrl="/aicampaigns/"
                formCardOptions={{ sx: { width: { xs: '95%', sm: '80%', md: '65%', lg: '55%' } } }}
                onSubmitExtended={saveToServer}
                onError={err => setAlertCfg({
                    open: true,
                    message: err?.message?.replace(/^Error:\s*/, '') || 'Something went wrong',
                    severity: 'error'
                })}
                onBackExtended={() => setCampaignState({ campaignInitialValuesDict: null })}
            />
        </MUICenterLayout>
    );
}
