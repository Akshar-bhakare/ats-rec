// AICampaignDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card, CardContent, Typography, Button,
    Divider, Box,
    Container,
    Tooltip,
    IconButton,
} from '@mui/material';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import CampaignIcon from '@mui/icons-material/Campaign';
import DownloadIcon from '@mui/icons-material/Download';

import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIModal from '../MUI/commonUI/MUIModal';
import { fetchData } from '../../AppUtils/dataAPI';
import { useAICampaignContextState } from '../../contexts/AICampaignContext';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';
import { RefreshRounded } from '@mui/icons-material';

const fmtDT = ts => (ts ? new Date(ts).toLocaleString() : '—');

function getSkillKeys(arr) {
    if (!Array.isArray(arr)) return arr || '—';
    return arr
        .map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                const [skill, val] = Object.entries(item)[0] || [];
                if (!skill) return '';
                return val === 1 || val == null ? skill : `${skill}:${val}`;
            }
            return '';
        })
        .filter(Boolean)
        .join(', ');
}

function getJobNamesFromCampaign(c) {
    if (!c) return '—';
    if (Array.isArray(c.items)) {
        const byJobName = Array.from(new Set(c.items.map(it => it?.jobName).filter(Boolean)));
        if (byJobName.length) return byJobName.join(', ');
    }
    if (Array.isArray(c.items)) {
        const byCommon = Array.from(new Set(
            c.items
                .map(it =>
                    it?.title ||
                    it?.name ||
                    it?.jobTitle ||
                    it?.job_name ||
                    it?.job?.title ||
                    it?.job?.name ||
                    it?.job?.jobTitle
                )
                .filter(Boolean)
        ));
        if (byCommon.length) return byCommon.join(', ');
    }
    const jobCollections = []
        .concat(Array.isArray(c.campaign_jobs) ? c.campaign_jobs : [])
        .concat(Array.isArray(c.jobs) ? c.jobs : [])
        .concat(Array.isArray(c.campaignJobs) ? c.campaignJobs : []);
    if (jobCollections.length && Array.isArray(c.items)) {
        const jobMap = {};
        jobCollections.forEach(j => (jobMap[j?._id || j?.id] = j?.title || j?.name || j?.jobTitle || j?.job_name));
        const names = Array.from(new Set(c.items.map(it => jobMap[it?.jobId]).filter(Boolean)));
        if (names.length) return names.join(', ');
    }
    if (c?.jobNames) return c.jobNames;
    if (Array.isArray(c.items)) {
        const ids = Array.from(new Set(c.items.map(it => it?.jobId).filter(Boolean)));
        if (ids.length) return ids.join(', ');
    }
    return '—';
}

export default function AICampaignDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [, setCampaignState] = useAICampaignContextState();
    const [, setAuthState] = useAuthContextState();
    const [, setUiState] = useUiContextState();

    const [camp, setCamp] = useState(null);
    const [campDelOpen, setCampDelOpen] = useState(false);
    const [campClearScheduleOpen, setCampClearScheduleOpen] = useState(false);

    const [rows, setRows] = useState([]);
    const [jobNames, setJobNames] = useState('—');
    const [succOpen, setSuccOpen] = useState(false);
    const [succMsg, setSuccMsg] = useState('Call triggered successfully.');

    const [confOpen, setConfOpen] = useState(false);
    const [confMsg, setConfMsg] = useState('');
    const [confAction, setConfAction] = useState(() => { });

    const askConfirmation = (msg, action) => {
        setConfMsg(msg);
        setConfAction(() => action);
        setConfOpen(true);
    };

    const loadCampaignData = async () => {
        console.log('[AICampaignDetail] loadCampaignData start id=', id);
        setUiState({ loadingMsg: 'Loading, Please wait...' });

        const c = await fetchData(`/api/campaigns/${id}`).catch(err => {
            console.error('[AICampaignDetail] fetch campaign failed', err);
            return null;
        });

        setUiState({ loadingMsg: null });

        if (!c) {
            console.log('[AICampaignDetail] loadCampaignData: no campaign returned');
            return;
        }

        console.log('[AICampaignDetail] loadCampaignData: campaign loaded', c._id || c.id);
        setCamp(c);

        const initialNames = getJobNamesFromCampaign(c);
        setJobNames(initialNames);

        const idsFromItems = Array.isArray(c.items)
            ? Array.from(new Set(c.items.map(it => it?.jobId).filter(Boolean)))
            : [];

        const looksLikeJustIds =
            !!idsFromItems.length &&
            (initialNames === '—' ||
                idsFromItems.every(id => initialNames.includes(id)));

        if (looksLikeJustIds) {
            try {
                console.log('[AICampaignDetail] resolving job ids to names', idsFromItems);
                setUiState({ loadingMsg: 'Loading, Please wait...' });
                let jobs = await fetchData(`/api/jobs/?ids=${encodeURIComponent(idsFromItems.join(','))}`).catch(() => null);
                setUiState({ loadingMsg: null });

                if (!Array.isArray(jobs) || jobs.length === 0) {
                    setUiState({ loadingMsg: 'Loading, Please wait...' });
                    jobs = await fetchData(`/api/jobs/list?ids=${encodeURIComponent(idsFromItems.join(','))}`).catch(() => null);
                    setUiState({ loadingMsg: null });
                }

                if (Array.isArray(jobs) && jobs.length) {
                    const byId = {};
                    jobs.forEach(j => (byId[j?._id || j?.id] = j?.title || j?.name || j?.jobTitle || j?.job_name));
                    const names = Array.from(new Set(idsFromItems.map(id => byId[id]).filter(Boolean)));
                    if (names.length) setJobNames(names.join(', '));
                    console.log('[AICampaignDetail] resolved job names', names);
                }
            } catch (e) {
                console.warn('[AICampaignDetail] job name resolution failed (ignored)', e);
            } finally {
                setUiState({ loadingMsg: null });
            }
        }

        const ids = [...new Set((c.items || []).map(i => i.candidateId).filter(Boolean))];
        if (!ids.length) {
            setRows([]);
            console.log('[AICampaignDetail] no campaign items -> rows cleared');
            return;
        }

        setUiState({ loadingMsg: 'Loading, Please wait...' });

        const cl = c.campaign_cands || [];

        setUiState({ loadingMsg: null });

        const map = {};
        cl.forEach(cd => (map[cd._id] = cd));

        const mappedRows = (c.items || []).map((it, index) => {
            const cd = map[it.candidateId] || {};
            return {
                ...cd,
                id: String(cd._id) +"___"+ String(index),
                skills: getSkillKeys(cd.skills),
                schedule: fmtDT(it.scheduleTime),
                job: it.jobId,
                aiCallStatus: it.aiCallStatus ?? 'pending',
                aiCallHangUpCause: it.aiCallHangUpCause ?? 'N/A',
                aiCallHangUpSource: it.aiCallHangUpSource ?? 'N/A',
                callAudioDuration: it.callAudioDuration ?? 'N/A',
                interested: it.interested ?? 'N/A',
            };
        });

        setRows(mappedRows);
        console.log('[AICampaignDetail] rows set, count=', mappedRows.length);
    }

    useEffect(() => {
        if (!id) return;

        loadCampaignData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const deleteCampaign = async () => {
        console.log('[AICampaignDetail] deleteCampaign start id=', id);
        setUiState({ loadingMsg: 'Loading, Please wait...' });
        await fetchData(`/api/campaigns/${id}`, { method: 'DELETE' });
        setUiState({ loadingMsg: null });
        console.log('[AICampaignDetail] deleteCampaign done, navigating to list');
        nav('/aicampaigns');
    };

    const clearCampaignSchedule = async () => {
        console.log('[AICampaignDetail] clearCampaignSchedule start id=', id);
        setUiState({ loadingMsg: 'Loading, Please wait...' });

        try {
            await fetchData(`/api/campaigns/clearSchedule/${id}`, { method: 'DELETE' });
            console.log('[AICampaignDetail] clearCampaignSchedule: server cleared schedule');

            setCampClearScheduleOpen(false);

            const updatedCamp = await fetchData(`/api/campaigns/${id}`).catch(err => {
                console.error('[AICampaignDetail] fetch updated campaign after clear failed', err);
                return null;
            });

            await loadCampaignData();

            if (updatedCamp) {
                console.log('[AICampaignDetail] updating global aICampaignListRows with updated campaign', updatedCamp._id);
                const jobNamesUpdated = Array.isArray(updatedCamp.items)
                    ? Array.from(new Set(updatedCamp.items.map(item => item.jobName).filter(Boolean))).join(', ')
                    : '';

                setCampaignState(prev => {
                    const existing = prev?.aICampaignListRows || [];
                    const newRows = existing.map(r => {
                        const rId = (r._id || r.id || '').toString();
                        const match = rId && (rId === (updatedCamp._id?.toString() || updatedCamp.id?.toString()));
                        if (!match) return r;
                        return {
                            ...r,
                            items: updatedCamp.items,
                            jobNames: jobNamesUpdated,
                            scheduleTime: updatedCamp.scheduleTime ? new Date(updatedCamp.scheduleTime) : null,
                            campStatus: updatedCamp.campStatus || '—',
                        };
                    });
                    return { aICampaignListRows: newRows };
                });
                // console.log('[AICampaignDetail] global list updated for campaign', updatedCamp._id);
            } else {
                console.log('[AICampaignDetail] updatedCamp not returned, skipped updating global list');
            }
        } catch (err) {
            console.error('[AICampaignDetail] clearCampaignSchedule failed', err);
        } finally {
            setUiState({ loadingMsg: null });
            console.log('[AICampaignDetail] clearCampaignSchedule finished');
        }
    };

    const downloadTracker = async () => {
        try {
            const idsAndJobs = rows
                .filter(
                    r =>
                        /^[0-9a-fA-F]{24}$/.test(r._id) &&
                        r.job &&
                        /^[0-9a-fA-F]{24}$/.test(r.job)
                )
                .map(r => ({ candidateId: r._id, jobId: r.job }));

            if (!idsAndJobs.length) {
                alert('No valid candidates to export.');
                return;
            }

            const uniqueCandidateIds = [...new Set(idsAndJobs.map(({ candidateId }) => candidateId))];
            const uniqueJobIds = [...new Set(idsAndJobs.map(({ jobId }) => jobId))];

            const idsParam = uniqueCandidateIds.join(',');
            const jobParam = uniqueJobIds.length === 1
                ? `&jobId=${encodeURIComponent(uniqueJobIds[0])}`
                : '';

            setUiState({ loadingMsg: 'Loading, Please wait...' });

            const blob = await fetchData(
                `/api/candidates/tracker/?ids=${encodeURIComponent(idsParam)}${jobParam}`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    },
                }
            );

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `campaign_${camp.name}_${camp._id}_tracker.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[Tracker] downloadTracker failed:', err);
            alert('Could not download tracker - please try again.');
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const triggerAll = async () => {
        const pairs = rows.filter(r => r.id && r.job).map(r => ({ candidateId: r?._id, jobId: r.job }));
        if (!pairs.length) return alert('No candidates to trigger.');
        setUiState({ loadingMsg: 'Triggering AI Calls, please wait…' });

        try {
            for (let { candidateId, jobId } of pairs) {
                setUiState({ loadingMsg: 'Loading, Please wait...' });
                await fetchData(`/api/ai/call/trigger/plivo/${candidateId}/${jobId}/`);
                setUiState({ loadingMsg: null });
            }
            setSuccMsg('AI call(s) triggered successfully.');
            loadCampaignData();
            setSuccOpen(true);

        } catch (err) {
            console.error('Trigger all failed:', err);
            setSuccMsg('Failed to trigger some calls, ' + err + '. Please try again.');
            setSuccOpen(true);

        } finally {
            setUiState({ loadingMsg: null });
            setAuthState({ user: null });
        }
    };

    const triggerSingle = async (candidateId, jobId, again = false) => {
        try {
            setUiState({ loadingMsg: 'Loading, Please wait...' });
            await fetchData(`/api/ai/call/trigger/plivo/${candidateId}/${jobId}/`);
            setSuccMsg(`AI call${again ? ' again' : ''} triggered successfully.`);
            setSuccOpen(true);
            loadCampaignData();

        } catch (err) {
            console.error('Error triggering call', err);
            setSuccMsg('Failed to trigger call, ' + err + '. Please try again.');
            setSuccOpen(true);

        } finally {
            setUiState({ loadingMsg: null });
            setAuthState({ user: null });
        }
    };

    const columns = [
        { field: 'id', headerName: 'ID', width: 80 },
        { field: 'firstName', headerName: 'First Name', width: 150 },
        { field: 'lastName', headerName: 'Last Name', width: 150 },
        { field: 'email', headerName: 'Email', width: 220 },
        { field: 'phoneNumber', headerName: 'Phone', width: 150 },
        { field: 'skills', headerName: 'Skills', flex: 1, minWidth: 220 },
        { field: 'aiCallStatus', headerName: 'AI Call Status', width: 140 },
        { field: 'aiCallHangUpCause', headerName: 'Hang-Up Cause', width: 140 },
        { field: 'aiCallHangUpSource', headerName: 'Hang-Up By', width: 140 },
        { field: 'callAudioDuration', headerName: 'Call Duration', width: 140 },
        { field: 'interested', headerName: 'Interested', width: 140 },
    ];

    if (!camp) {
        return (
            <MUICenterLayout>
                <Typography>Loading…</Typography>
            </MUICenterLayout>
        );
    }

    const isBlocked = String(camp?.campStatus || '').toLowerCase() === 'blocked';

    return (
        <MUICenterLayout>
            <Container
                maxWidth="xl"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '80vh',
                    py: 4,
                }}
            >
                <Card sx={{ mx: 'auto' }}>
                    <CardContent>
                        <MUIButton
                            startIcon={<ArrowBackIosIcon />}
                            sx={{ mb: 4, border: "none" }}
                            onClick={() => nav(-1)}
                        >
                            Back
                        </MUIButton>

                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 1,
                                mb: 3,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Typography
                                variant="h5"
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <CampaignIcon fontSize="inherit" /> {camp.name} <Tooltip title="Refresh"><IconButton onClick={() => loadCampaignData()}><RefreshRounded /></IconButton></Tooltip>
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {!isBlocked && (
                                    <MUIButton onClick={() => setCampClearScheduleOpen(true)}>
                                        Clear Schedule
                                    </MUIButton>
                                )}
                                <MUIButton onClick={() => setCampDelOpen(true)}>
                                    Archive
                                </MUIButton>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 3 }} />

                        <Box
                            sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                gap: 4,
                                mb: 4,
                            }}
                        >
                            {[
                                ['Created', fmtDT(camp.createdAt)],
                                // ['Last Updated', fmtDT(camp.updatedAt)],
                                ['Scheduled At', fmtDT(camp.scheduleTime)],
                                ['Items', camp.items?.length || 0],
                                ['Jobs', jobNames],
                                ['Status', camp.campStatus],
                            ].map(([l, v]) => (
                                <Box key={l} sx={{ flex: '1 1 200px', textAlign: 'center' }}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        {l}
                                    </Typography>
                                    <Typography>{v}</Typography>
                                </Box>
                            ))}
                        </Box>

                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 1,
                            }}
                        >
                            <Typography variant="h6">Candidates in Campaign</Typography>
                            <Box>
                                <MUIButton
                                    startIcon={<DownloadIcon />}
                                    onClick={downloadTracker}
                                    sx={{ mr: 1 }}
                                >
                                    Download tracker
                                </MUIButton>
                                <MUIButton
                                    startIcon={<CampaignIcon />}
                                    onClick={() =>
                                        askConfirmation(
                                            'Trigger AI calls for all candidates in this campaign?',
                                            triggerAll
                                        )
                                    }
                                >
                                    Run Campaign {camp.campStatus === "Executed" ? "again" : ""}
                                </MUIButton>
                            </Box>
                        </Box>

                        <Box sx={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
                            <MUIRetrieveDataGrid
                                title={null}
                                rows={rows}
                                columns={columns}
                                onRowClick={row => nav(`/candidates/${row.id?.split("___")[0]}`)}
                                listActionsExtended={params => (
                                    <MUIButton
                                        size="small"
                                        sx={{ mx: 1 }}
                                        onClick={e => {
                                            e.stopPropagation();
                                            const { _id: candidateId, job, aiCallStatus } = params.row;
                                            askConfirmation(
                                                `Trigger AI call${aiCallStatus === 'pending' ? '' : ' again'} for this candidate?`,
                                                () => triggerSingle(
                                                    candidateId,
                                                    job,
                                                    aiCallStatus !== 'pending'
                                                )
                                            );
                                        }}
                                    >
                                        Trigger Ai Call
                                        {params?.row?.aiCallStatus === 'pending' ? '' : ' Again'}
                                    </MUIButton>
                                )}
                                actionColumnsProps={{ minWidth: 340 }}
                                hideToolbar
                                pageSize={100}
                                autoHeight
                            />
                        </Box>
                    </CardContent>

                    <MUIArchiveCnfModal
                        key="DeleteModal"
                        open={campDelOpen}
                        onClose={() => setCampDelOpen(false)}
                        onConfirm={deleteCampaign}
                        itemName={camp.name}
                    />

                    <MUIArchiveCnfModal
                        key="clearSchedule"
                        open={campClearScheduleOpen}
                        onClose={() => setCampClearScheduleOpen(false)}
                        onConfirm={clearCampaignSchedule}
                        actionName='Clear Schedule'
                        itemName={camp.name}
                    />
                </Card>

                <MUIModal open={confOpen} onClose={() => setConfOpen(false)}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="h6">Confirm</Typography>
                        <Typography>{confMsg}</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
                            <MUIButton onClick={() => setConfOpen(false)}>Cancel</MUIButton>
                            <MUIButton
                                onClick={() => {
                                    setConfOpen(false);
                                    confAction();
                                }}
                            >
                                Yes, Continue
                            </MUIButton>
                        </Box>
                    </Box>
                </MUIModal>

                <MUIModal
                    open={succOpen}
                    onClose={() => {
                        setSuccOpen(false);
                        // if (reloadOnClose) window.location.reload();
                    }}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="h6">Success</Typography>
                        <Typography>{succMsg}</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
                            <MUIButton
                                onClick={() => {
                                    setSuccOpen(false);
                                    // if (reloadOnClose) window.location.reload();
                                }}
                            >
                                OK
                            </MUIButton>
                        </Box>
                    </Box>
                </MUIModal>
            </Container>
        </MUICenterLayout>
    );
}
