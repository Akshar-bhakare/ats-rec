import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    TextField,
    MenuItem,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
    Call,
    CancelOutlined,
    ClearAllOutlined,
    ScheduleOutlined,
    SaveOutlined,
    UpdateOutlined,
} from '@mui/icons-material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import MUIInput from '../MUI/commonUI/MUIInput';
import { useUiContextState } from '../../contexts/UiContext';
import { fetchData } from '../../AppUtils/dataAPI';
import { getLongDateTimeStr } from '../../AppUtils/dateFormatters';
import BulkInterviewScheduleModal from './BulkInterviewScheduleModal';

const STAGE_STATUS_CHOICES = ['Not Initiated', 'Selected', 'Rejected', 'On Hold', 'Completed', 'Not Applicable'];

const normalizeStageKey = (stage) => {
    if (!stage) return '';
    if (typeof stage === 'string') return stage;
    if (typeof stage === 'object') {
        if (stage._id) return String(stage._id);
        if (stage.id) return String(stage.id);
        if (stage.title) return String(stage.title);
    }
    return '';
};

const normalizeStageStatus = (status) => {
    const value = String(status || '').trim();
    return value || 'Not Initiated';
};


export default function CandidateFlowSection({
    job,
    rows = [],
    columns = [],
    loadData,
    requiresAssignment = false,
    assignmentNotice,
    toolbarPrefix = null,
    extraToolbarButtons = null,
    rowActionsBuilder = null,
    onRowClick,
    actionColumnsProps,
    dataGridProps = {},
    showClearScheduleControl = true,
    enableInterviewScheduling = false,
}) {
    const theme = useTheme();
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();

    const [candidateListSelection, setCandidateListSelection] = useState([]);
    const [stageFilterModalOpen, setStageFilterModalOpen] = useState(false);
    const [selectedStage, setSelectedStage] = useState(null);
    const [selectedStageStatus, setSelectedStageStatus] = useState('');
    const [stageFilterApplied, setStageFilterApplied] = useState(false);
    const [showScheduleTimeModal, setShowScheduleTimeModal] = useState(false);
    const [scheduleDateTime, setScheduleDateTime] = useState(dayjs().add(5, 'minute'));
    const [interviewScheduleModalOpen, setInterviewScheduleModalOpen] = useState(false);
    const [interviewScheduleDrafts, setInterviewScheduleDrafts] = useState([]);
    const [bulkScheduleAt, setBulkScheduleAt] = useState(dayjs().add(10, 'minute'));
    const [interviewScheduleSearch, setInterviewScheduleSearch] = useState('');
    const [succOpen, setSuccOpen] = useState(false);
    const [succMsg, setSuccMsg] = useState('Call triggered successfully.');

    const [confOpen, setConfOpen] = useState(false);
    const [confMsg, setConfMsg] = useState('');
    const [confAction, setConfAction] = useState(() => () => { });

    const [alertCfg, setAlertCfg] = useState({ open: false, message: '', severity: 'info' });

    const closeAlert = (_e, r) => r !== 'clickaway' && setAlertCfg(a => ({ ...a, open: false }));

    const askConfirmation = (msg, action) => {
        setConfMsg(msg);
        setConfAction(() => action);
        setConfOpen(true);
    };

    const maxDtLmt = dayjs().add(50, 'hour').toDate();

    const validSelectionIds = useMemo(() => (
        (candidateListSelection || []).filter(id => /^[0-9a-fA-F]{24}$/.test(id))
    ), [candidateListSelection]);

    const stageOptions = useMemo(() => {
        if (!enableInterviewScheduling) return [];
        const seen = new Map();
        (rows || []).forEach(row => {
            const stageResults = Array.isArray(row?.stageResults) ? row.stageResults : [];
            stageResults.forEach(sr => {
                const stage = sr?.stage;
                const key = normalizeStageKey(stage);
                if (!key || seen.has(key)) return;
                const label =
                    (typeof stage === 'object' && stage?.title)
                        ? stage.title
                        : key;
                seen.set(key, {
                    value: key,
                    label,
                    createdAt: (typeof stage === 'object' && stage?.createdAt) ? stage.createdAt : null,
                });
            });
        });

        return Array.from(seen.values()).sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return aTime - bTime;
        });
    }, [rows, enableInterviewScheduling]);

    const stageStatusOptions = useMemo(() => {
        if (!enableInterviewScheduling) return [];
        return STAGE_STATUS_CHOICES;
    }, [enableInterviewScheduling]);

    const buildInterviewScheduleDrafts = (rowsToSchedule = [], scheduleAt) => (
        (rowsToSchedule || []).map(row => ({
            id: row?.id,
            atsId: row?.atsId,
            firstName: row?.firstName || '',
            lastName: row?.lastName || '',
            email: row?.email || '',
            phoneNumber: row?.phoneNumber || '',
            targetStageId:
                stageFilterApplied && /^[0-9a-fA-F]{24}$/.test(String(selectedStage?.value || ''))
                    ? String(selectedStage.value)
                    : '',
            targetStageTitle:
                stageFilterApplied
                    ? String(selectedStage?.label || selectedStage?.value || '').trim()
                    : '',
            scheduleAt,
            durationMinutes: 45
        }))
    );

    const filteredRows = useMemo(() => {
        if (!enableInterviewScheduling || !stageFilterApplied) return rows || [];
        const key = String(selectedStage?.value || '');
        if (!key) return [];

        return (rows || []).filter(row => {
            const stageResults = Array.isArray(row?.stageResults) ? row.stageResults : [];
            const match = stageResults.find(sr => {
                const stageKey = normalizeStageKey(sr?.stage);
                return stageKey && stageKey === key;
            });
            if (!match) return false;
            const matchStatus = normalizeStageStatus(match.stageStatus);
            if (!selectedStageStatus) return true;
            return matchStatus === normalizeStageStatus(selectedStageStatus);
        });
    }, [rows, enableInterviewScheduling, stageFilterApplied, selectedStage, selectedStageStatus]);

    const displayRows = useMemo(() => (
        enableInterviewScheduling && stageFilterApplied ? filteredRows : rows
    ), [rows, filteredRows, enableInterviewScheduling, stageFilterApplied]);

    useEffect(() => {
        if (!enableInterviewScheduling || !stageFilterApplied) return;
        const stageKey = String(selectedStage?.value || '');
        console.info('[CandidateFlow] stage filter applied', {
            stage: selectedStage?.label || stageKey,
            stageKey,
            stageStatus: selectedStageStatus || 'N/A',
            totalRows: rows?.length || 0,
            filteredRows: filteredRows?.length || 0,
        });
    }, [enableInterviewScheduling, stageFilterApplied, selectedStage, selectedStageStatus, rows, filteredRows]);

    const ensureCandidatesAssigned = async candidateIds => {
        if (!requiresAssignment) return true;
        if (!job?._id) {
            alert('Job not found. Please reload and try again.');
            return false;
        }
        if (!candidateIds?.length) return false;

        setUiState({ loadingMsg: 'Assigning selected candidates to this job…' });
        try {
            const payload = {
                candidateIds,
                jobIds: [job._id],
            };
            const res = await fetchData('/api/candidates/assign-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }).catch(e => ({ error: e?.message || 'Failed' }));

            if (res?.error) {
                setAlertCfg({ open: true, message: res.error, severity: 'error' });
                return false;
            }

            if (Array.isArray(res?.skipped) && res.skipped.length) {
                setAlertCfg({
                    open: true,
                    message: `${res.skipped.length} candidate(s) were already assigned and skipped.`,
                    severity: 'info',
                });
            }

            return true;
        } catch (err) {
            console.error('[CandidateFlow] ensureCandidatesAssigned failed:', err);
            setAlertCfg({
                open: true,
                message: err?.message || 'Failed to assign candidates. Please try again.',
                severity: 'error',
            });
            return false;
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const resetSelection = () => {
        setCandidateListSelection([]);
        setStageFilterApplied(false);
        if (typeof loadData === 'function') {
            loadData();
        }
    };

    const disableInterviewFilter = () => {
        setStageFilterApplied(false);
    };

    const applyStageFilter = () => {
        if (!selectedStage) {
            setAlertCfg({ open: true, message: 'Select a stage to continue.', severity: 'warning' });
            return;
        }
        if (!selectedStageStatus) {
            setAlertCfg({ open: true, message: 'Select a stage status to continue.', severity: 'warning' });
            return;
        }

        setStageFilterApplied(true);
        setCandidateListSelection([]);
        setStageFilterModalOpen(false);

        const nextFilteredRows = (rows || []).filter(row => {
            const stageResults = Array.isArray(row?.stageResults) ? row.stageResults : [];
            const match = stageResults.find(sr => {
                const stageKey = normalizeStageKey(sr?.stage);
                return stageKey && stageKey === String(selectedStage?.value || '');
            });
            if (!match) return false;
            const matchStatus = normalizeStageStatus(match.stageStatus);
            return matchStatus === normalizeStageStatus(selectedStageStatus);
        });

        if (!nextFilteredRows.length) {
            setAlertCfg({
                open: true,
                message: 'No candidates found for the selected stage and status. You can change the filter and try again.',
                severity: 'info',
            });
        }
    };

    const triggerMultipleCalls = async () => {
        if (!validSelectionIds.length) {
            alert('No valid candidates to trigger.');
            return;
        }

        if (requiresAssignment) {
            const assigned = await ensureCandidatesAssigned(validSelectionIds);
            if (!assigned) return;
        }

        setUiState({ loadingMsg: 'Triggering AI Calls, please wait…' });

        try {
            const failures = [];

            for (let candidateId of validSelectionIds) {
                try {
                    await fetchData(`/api/ai/call/trigger/plivo/${candidateId}/${job?._id}/`);
                } catch (err) {
                    const errMsg = (err?.message || err?.error) || JSON.stringify(err);
                    failures.push(`${candidateId}, ${job?._id}: ${errMsg}`);
                    console.error(`Trigger call failed for ${candidateId}`, err);
                }
            }

            if (!failures.length) {
                setSuccMsg('AI call(s) triggered successfully.');
                resetSelection();
            } else {
                loadData?.();
                setSuccMsg('Failed to trigger some calls, ' + failures.join('; ') + '. Please try again.');
            }

            setSuccOpen(true);
        } catch (err) {
            loadData?.();
            console.error('Trigger all failed:', err);
            setSuccMsg('Failed to trigger some calls, ' + ((err?.message || err?.error) || JSON.stringify(err)) + '. Please try again.');
            setSuccOpen(true);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const triggerSingle = async (candidateId, again = false) => {
        const ids = [candidateId].filter(id => /^[0-9a-fA-F]{24}$/.test(id));
        if (!ids.length) return;

        if (requiresAssignment) {
            const assigned = await ensureCandidatesAssigned(ids);
            if (!assigned) return;
        }

        try {
            setUiState({ loadingMsg: 'Triggering, Please wait...' });
            await fetchData(`/api/ai/call/trigger/plivo/${candidateId}/${job?._id}/`);
            setSuccMsg(`AI call${again ? ' again' : ''} triggered successfully.`);
            setSuccOpen(true);
        } catch (err) {
            loadData?.();
            console.error('Error triggering call', err);
            setSuccMsg('Failed to trigger call, ' + (err?.message || JSON.stringify(err)) + '. Please try again.');
            setSuccOpen(true);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const triggerWhatsappMultiple = async () => {
        if (!validSelectionIds.length) {
            alert('No valid candidates to initiate WhatsApp conversations.');
            return;
        }

        if (requiresAssignment) {
            const assigned = await ensureCandidatesAssigned(validSelectionIds);
            if (!assigned) return;
        }

        setUiState({ loadingMsg: 'Initiating WhatsApp conversations, please wait…' });

        try {
            for (let candidateId of validSelectionIds) {
                await fetchData(`/api/ai/call/trigger/whatsapp/${candidateId}/${job?._id}/`);
            }
            setSuccMsg('WhatsApp conversation(s) initiated successfully.');
            resetSelection();
            setSuccOpen(true);
        } catch (err) {
            console.error('Trigger WhatsApp all failed:', err);
            setSuccMsg('Failed to initiate some WhatsApp conversations, ' + ((err?.message || err?.error) || JSON.stringify(err)) + '. Please try again.');
            setSuccOpen(true);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const triggerWhatsappSingle = async candidateId => {
        const ids = [candidateId].filter(id => /^[0-9a-fA-F]{24}$/.test(id));
        if (!ids.length) return;

        if (requiresAssignment) {
            const assigned = await ensureCandidatesAssigned(ids);
            if (!assigned) return;
        }

        try {
            setUiState({ loadingMsg: 'Initiating WhatsApp conversation, please wait...' });
            await fetchData(`/api/ai/call/trigger/whatsapp/${candidateId}/${job?._id}/`);
            setSuccMsg('WhatsApp conversation initiated successfully.');
            setSuccOpen(true);
        } catch (err) {
            console.error('Error triggering WhatsApp conversation', err);
            setSuccMsg('Failed to initiate WhatsApp conversation, ' + (err?.message || JSON.stringify(err)) + '. Please try again.');
            setSuccOpen(true);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const openInterviewScheduleModal = () => {
        const selectedRows = (displayRows || []).filter(row =>
            (candidateListSelection || []).includes(row?.id)
        );

        const scheduleTargets = selectedRows
            .filter(row => /^[0-9a-fA-F]{24}$/.test(String(row?.atsId)));

        if (!scheduleTargets.length) {
            setAlertCfg({
                open: true,
                message: 'No valid candidates to schedule interview.',
                severity: 'warning',
            });
            return;
        }

        const baseTime = dayjs().add(10, 'minute');
        setBulkScheduleAt(baseTime);
        setInterviewScheduleDrafts(buildInterviewScheduleDrafts(scheduleTargets, baseTime));
        setInterviewScheduleSearch('');
        setInterviewScheduleModalOpen(true);
    };

    const updateInterviewScheduleTime = (candidateId, nextVal) => {
        setInterviewScheduleDrafts(prev =>
            (prev || []).map(item =>
                item.id === candidateId ? { ...item, scheduleAt: nextVal } : item
            )
        );
    };

    const updateInterviewDuration = (candidateId, nextVal) => {
        setInterviewScheduleDrafts(prev =>
            (prev || []).map(item =>
                item.id === candidateId
                    ? { ...item, durationMinutes: Number(nextVal) || 45 }
                    : item
            )
        );
    };

    const filteredInterviewScheduleDrafts = useMemo(() => {
        const search = interviewScheduleSearch.trim().toLowerCase();
        if (!search) return interviewScheduleDrafts || [];
        return (interviewScheduleDrafts || []).filter(item => {
            const haystack = [
                item?.firstName,
                item?.lastName,
                item?.email,
                item?.phoneNumber,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(search);
        });
    }, [interviewScheduleDrafts, interviewScheduleSearch]);

    const continueToInterviewScheduler = () => {
        const atsIds = (interviewScheduleDrafts || [])
            .map(item => item?.atsId)
            .filter(id => /^[0-9a-fA-F]{24}$/.test(String(id)));

        if (!atsIds.length) {
            setAlertCfg({ open: true, message: 'No valid candidates to schedule.', severity: 'warning' });
            return;
        }

        const invalidSchedules = (interviewScheduleDrafts || []).filter(item => {
            const dt = dayjs(item.scheduleAt);
            return !dt.isValid();
        });
        if (invalidSchedules.length) {
            setAlertCfg({
                open: true,
                message: 'Please select interview date & time for all candidates.',
                severity: 'warning',
            });
            return;
        }

        const params = new URLSearchParams();
        params.set('atsids', atsIds.join(','));
        if (job?._id) params.set('jid', job._id);
        const scheduleMap = {};
        (interviewScheduleDrafts || []).forEach(item => {
            if (!item?.atsId) return;
            const dt = dayjs(item.scheduleAt);
            if (!dt.isValid()) return;
            scheduleMap[String(item.atsId)] = {
                scheduleAt: dt.toISOString(),
                durationMinutes: Number(item.durationMinutes) || 45,
                targetStageId: item?.targetStageId || '',
                targetStageTitle: item?.targetStageTitle || '',
            };
        });
        try {
            const key = `interview_schedule_${Date.now()}`;
            sessionStorage.setItem(key, JSON.stringify(scheduleMap));
            params.set('scheduleKey', key);
            // eslint-disable-next-line no-unused-vars
        } catch (err) {
            const fallback = dayjs(bulkScheduleAt);
            if (fallback.isValid()) {
                params.set('scheduleAt', fallback.toISOString());
            }
        }
        setInterviewScheduleModalOpen(false);
        navigate(`/interviews/schedule/?${params.toString()}`);
    };

    const scheduleCalls = async () => {
        if (!validSelectionIds.length) {
            alert('No valid candidates to Schedule.');
            return;
        }

        if (requiresAssignment) {
            const assigned = await ensureCandidatesAssigned(validSelectionIds);
            if (!assigned) return;
        }

        const isoTime = scheduleDateTime ? dayjs(scheduleDateTime).toISOString() : null;

        const scheduleMs = new dayjs(scheduleDateTime).toDate().getTime();
        if (scheduleMs <= new Date().getTime() && scheduleMs >= maxDtLmt.getTime()) {
            setAlertCfg({ open: true, message: 'Invalid date-time combination, for scheduling AI Call(s)...', severity: 'error' });
            return;
        }

        setUiState({ loadingMsg: 'Scheduling AI Calls, please wait...' });

        try {
            await fetchData(`/api/ai/call/schedule/`, {
                method: "POST",
                body: JSON.stringify({
                    candidates: validSelectionIds?.map?.(ele => ({
                        _id: ele,
                        jobId: job?._id
                    })),
                    scheduleTime: isoTime
                })
            });
            setSuccMsg('AI call(s) Scheduled successfully...');
            resetSelection();
            setShowScheduleTimeModal(false);
            setSuccOpen(true);
        } catch (err) {
            loadData?.();
            console.error('Scheduling failed:', err);
            setSuccMsg('Failed to Schedule some calls, ' + ((err?.message || err?.error) || JSON.stringify(err)) + '. Please try again...');
            setSuccOpen(true);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const changeCallSchedule = async () => {
        const candidateIds = [showScheduleTimeModal?.candidate]
            .filter(candId => /^[0-9a-fA-F]{24}$/.test(candId));

        if (!candidateIds.length) {
            alert('No valid candidates to Schedule.');
            return;
        }

        if (requiresAssignment) {
            const assigned = await ensureCandidatesAssigned(candidateIds);
            if (!assigned) return;
        }

        const isoTime = scheduleDateTime ? dayjs(scheduleDateTime).toISOString() : null;
        const scheduleMs = new dayjs(scheduleDateTime).toDate().getTime();

        if (scheduleMs <= new Date().getTime() && scheduleMs >= maxDtLmt.getTime()) {
            setAlertCfg({ open: true, message: 'Invalid date-time combination, for scheduling AI Call(s)...', severity: 'error' });
            return;
        }

        setUiState({ loadingMsg: 'Scheduling AI Calls, please wait...' });

        try {
            await fetchData(`/api/ai/call/schedule/change/`, {
                method: "PUT",
                body: JSON.stringify({
                    candidates: candidateIds?.map?.(ele => ({
                        _id: ele,
                        jobId: job?._id
                    })),
                    scheduleTime: isoTime,
                    existingScheduleTime: showScheduleTimeModal?.existingScheduleTime
                })
            });
            setSuccMsg('AI call(s) Schedule changed successfully...');
            resetSelection();
            setShowScheduleTimeModal(false);
            setSuccOpen(true);
        } catch (err) {
            loadData?.();
            console.error('Schedule changing failed:', err);
            setSuccMsg('Failed to Change Schedule of call, ' + ((err?.message || err?.error) || JSON.stringify(err)) + '. Please try again...');
            setSuccOpen(true);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const clearCallschedule = async () => {
        if (!validSelectionIds.length) {
            alert('No valid candidates to Schedule.');
            return;
        }

        if (requiresAssignment) {
            const assigned = await ensureCandidatesAssigned(validSelectionIds);
            if (!assigned) return;
        }

        setUiState({ loadingMsg: 'Clearing AI Call Schedule(s), please wait...' });

        try {
            await fetchData(`/api/ai/call/schedule/clear/`, {
                method: "DELETE",
                body: JSON.stringify({
                    candidates: validSelectionIds?.map?.(ele => ({
                        _id: ele,
                        jobId: job?._id
                    })),
                })
            });
            setSuccMsg('AI call Schedule(s) cleared successfully...');
            resetSelection();
            setShowScheduleTimeModal(false);
            setSuccOpen(true);
        } catch (err) {
            loadData?.();
            console.error('clearing Schedule failed:', err);
            setSuccMsg('Failed to clear some Schedule(s), ' + ((err?.message || err?.error) || JSON.stringify(err)) + '. Please try again...');
            setSuccOpen(true);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    useEffect(() => {
        if (showScheduleTimeModal) {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 5);
            setScheduleDateTime(dayjs().add(5, "minute"));
        }
    }, [job?._id, showScheduleTimeModal]);

    useEffect(() => {
        setCandidateListSelection(prev => (
            (prev || []).filter(id => (displayRows || []).some(r => String(r?.id) === String(id)))
        ));
    }, [displayRows]);

    const selectedCount = (candidateListSelection || []).length;
    const hasSelection = selectedCount > 0;

    const rowSelectionModel = useMemo(() => {
        const model = { type: "include", ids: new Set(candidateListSelection || []) };
        if ((candidateListSelection || [])?.length === 0) {
            model.type = "include";
            model.ids = new Set();
        } else if ((candidateListSelection || [])?.length === (displayRows || [])?.length) {
            model.type = "exclude";
            model.ids = new Set();
        } else {
            model.type = "include";
            model.ids = new Set(candidateListSelection || []);
        }
        return model;
    }, [candidateListSelection, displayRows]);

    const handleRowClick = row => {
        if (typeof onRowClick === 'function') {
            onRowClick(row);
        }
    };

    const defaultActionColumnsProps = { minWidth: 340 };
    const bulkActionButtonSx = {
        border: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
        bgcolor: 'transparent',
        boxShadow: 'none',
        '&:hover': {
            borderColor: theme.palette.text.secondary,
            bgcolor: alpha(theme.palette.action.hover, 0.6),
            boxShadow: 'none',
        },
    };

    return (
        <Box sx={{ mt: 3 }}>
            <MUIAlert {...alertCfg} onClose={closeAlert} />

            {assignmentNotice && requiresAssignment && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {assignmentNotice}
                </Typography>
            )}

            {toolbarPrefix}

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    mx: 2,
                    gap: 1.5,
                    mb: 2,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    pb: 0.5,
                }}
            >
                <Box sx={{ display: "flex", flexWrap: 'nowrap', gap: 1.5, minWidth: 'max-content' }}>
                    {enableInterviewScheduling && (
                        <MUIButton
                            startIcon={<ScheduleOutlined />}
                            onClick={() => {
                                if (!stageOptions.length) {
                                    setAlertCfg({
                                        open: true,
                                        message: 'No stages found for scheduling.',
                                        severity: 'warning',
                                    });
                                    return;
                                }

                                if (!stageFilterApplied || !candidateListSelection.length) {
                                    setStageFilterModalOpen(true);
                                } else {
                                    openInterviewScheduleModal();
                                }
                            }}
                            sx={bulkActionButtonSx}
                        >
                            Schedule Interview
                        </MUIButton>
                    )}

                    {hasSelection && (
                        <>
                        <MUIButton
                            startIcon={<ScheduleOutlined />}
                            onClick={() => {
                                disableInterviewFilter();
                                if (selectedCount === (displayRows || []).length) {
                                    askConfirmation(
                                        'Schedule AI calls for all selected candidates?',
                                        () => setShowScheduleTimeModal(true),
                                    );
                                    return;
                                }
                                setShowScheduleTimeModal(true);
                            }}
                            sx={bulkActionButtonSx}
                        >
                            Schedule Call(s)
                        </MUIButton>

                        {showClearScheduleControl && (
                            <MUIButton
                                startIcon={<CancelOutlined />}
                                onClick={() => {
                                    disableInterviewFilter();
                                    if (selectedCount === (displayRows || []).length) {
                                        askConfirmation(
                                            'Clear schedules for all selected candidates?',
                                            clearCallschedule,
                                        );
                                        return;
                                    }
                                    clearCallschedule();
                                }}
                                sx={bulkActionButtonSx}
                            >
                                Clear Schedule(s)
                            </MUIButton>
                        )}

                        <MUIButton
                            startIcon={<Call />}
                            onClick={() => {
                                disableInterviewFilter();
                                askConfirmation(
                                    'Trigger AI calls for selected candidates?',
                                    triggerMultipleCalls
                                );
                            }}
                            sx={bulkActionButtonSx}
                        >
                            Trigger Call(s)
                        </MUIButton>

                        <MUIButton
                            startIcon={<WhatsAppIcon />}
                            onClick={() => {
                                disableInterviewFilter();
                                askConfirmation(
                                    'Initiate WhatsApp conversations for selected candidates?',
                                    triggerWhatsappMultiple
                                );
                            }}
                            sx={bulkActionButtonSx}
                        >
                            Initiate WhatsApp
                        </MUIButton>

                        {extraToolbarButtons}

                        <MUIButton
                            startIcon={<ClearAllOutlined />}
                            onClick={resetSelection}
                            sx={bulkActionButtonSx}
                        >
                            Reset
                        </MUIButton>
                        </>
                    )}
                </Box>
            </Box>

            <MUIRetrieveDataGrid
                key={JSON.stringify(rowSelectionModel)}
                rows={displayRows}
                columns={columns}
                rowSelectionModel={rowSelectionModel}
                onRowClick={handleRowClick}
                checkboxSelection
                disableRowSelectionOnClick
                onRowSelectionModelChange={async (newSelection) => {
                    const selctnIds = [...newSelection?.ids || []];
                    if (newSelection?.type === "exclude" && selctnIds?.length === 0) {
                        setCandidateListSelection(displayRows?.map?.(ele => ele?.id) || []);
                    } else if (newSelection?.type === "include" && selctnIds?.length === 0) {
                        setCandidateListSelection([]);
                    } else if (newSelection?.type === "include" && selctnIds?.length !== 0) {
                        setCandidateListSelection(selctnIds);
                    } else {
                        console.info("No match found from our conditions... \n newSelection: ", newSelection);
                    }
                }}
                listActionsExtended={params => rowActionsBuilder ? rowActionsBuilder({
                    params,
                    openScheduleModal: ({ id, scheduleTime, existingScheduleTime }) => {
                        setShowScheduleTimeModal({ candidate: id, existingSch: scheduleTime, existingScheduleTime });
                    },
                    askConfirmation,
                    triggerSingle,
                    triggerWhatsappSingle,
                    job,
                }) : null}
                actionColumnsProps={actionColumnsProps || defaultActionColumnsProps}
                pageSize={10}
                rowsPerPageOptions={[10, 25, 50]}
                {...dataGridProps}
            />

            <MUIModal
                open={stageFilterModalOpen}
                onClose={() => setStageFilterModalOpen(false)}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="h6">Filter candidates for interview scheduling</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Pick a stage and its current status to show only matching candidates.
                    </Typography>
                    <MUIInput
                        AutocompleteProps={{
                            options: stageOptions,
                            freeSolo: false,
                            value: selectedStage,
                            onChange: (_ev, val) => {
                                setSelectedStage(val || null);
                                setSelectedStageStatus('');
                            },
                            size: 'small',
                        }}
                        AutocompleteInputProps={{
                            label: 'Select Stage',
                            required: true,
                        }}
                    />
                    <MUIInput
                        AutocompleteProps={{
                            options: stageStatusOptions,
                            freeSolo: false,
                            value: selectedStageStatus || null,
                            onChange: (_ev, val) => setSelectedStageStatus(val || ''),
                            size: 'small',
                            disabled: !selectedStage,
                        }}
                        AutocompleteInputProps={{
                            label: selectedStage ? 'Select Stage Status' : 'Select stage first',
                            required: true,
                        }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                        <MUIButton onClick={applyStageFilter}>Save</MUIButton>
                        <MUIButton onClick={() => setStageFilterModalOpen(false)}>Cancel</MUIButton>
                    </Box>
                </Box>
            </MUIModal>

            {/* <MUIModal
                open={interviewScheduleModalOpen}
                onClose={() => setInterviewScheduleModalOpen(false)}
                disableEscapeKeyDown
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '80vh' }}>
                    <Typography variant="h6">Schedule Interviews</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Review selected candidates, set the interview time and duration for each, then continue.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                            placeholder="Search candidate by name, email, or phone"
                            value={interviewScheduleSearch}
                            onChange={(e) => setInterviewScheduleSearch(e.target.value)}
                            size="small"
                            fullWidth
                            sx={{ flex: 1, minWidth: 240 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            Showing {filteredInterviewScheduleDrafts.length} of {interviewScheduleDrafts.length}
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
                                        borderColor: 'divider'
                                    }}
                                >
                                    <Typography variant="caption">First Name</Typography>
                                    <Typography variant="caption">Last Name</Typography>
                                    <Typography variant="caption">Email</Typography>
                                    <Typography variant="caption">Phone</Typography>
                                    <Typography variant="caption">Interview Date & Time</Typography>
                                    <Typography variant="caption">Duration</Typography>
                                </Box>

                                {filteredInterviewScheduleDrafts.map((item) => (
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
                                            '& > *': { minWidth: 0 }
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
                                                onChange={val => updateInterviewScheduleTime(item.id, val)}
                                                format="DD-MM-YYYY hh:mm A"
                                                slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                                sx={{ width: '100%' }}
                                            />
                                        </Box>
                                        <Box>
                                            <TextField
                                                select
                                                value={item.durationMinutes || 45}
                                                onChange={(e) => updateInterviewDuration(item.id, e.target.value)}
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

                                {filteredInterviewScheduleDrafts.length === 0 && (
                                    <Box sx={{ py: 3 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No candidates match your search.
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </LocalizationProvider>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                        <MUIButton
                            startIcon={<SaveOutlined />}
                            onClick={continueToInterviewScheduler}
                            disabled={!interviewScheduleDrafts.length}
                        >
                            Continue
                        </MUIButton>
                        <MUIButton
                            startIcon={<CancelOutlined />}
                            onClick={() => setInterviewScheduleModalOpen(false)}
                        >
                            Cancel
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal> */}


            <BulkInterviewScheduleModal
                open={interviewScheduleModalOpen}
                onClose={() => setInterviewScheduleModalOpen(false)}
                title="Schedule Interviews"
                drafts={interviewScheduleDrafts}
                filteredDrafts={filteredInterviewScheduleDrafts}
                searchValue={interviewScheduleSearch}
                onSearchChange={setInterviewScheduleSearch}
                onDateChange={updateInterviewScheduleTime}
                onDurationChange={updateInterviewDuration}
                onContinue={continueToInterviewScheduler}
                continueDisabled={!interviewScheduleDrafts.length}
            />


            <MUIModal open={Boolean(showScheduleTimeModal)} onClose={() => setShowScheduleTimeModal(false)} disableEscapeKeyDown>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="h6" sx={{ mb: 5 }}>{typeof showScheduleTimeModal === "object" ? "Change" : "Select"} Schedule date and time</Typography>

                    <>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DateTimePicker
                                label="Schedule Date & Time *"
                                value={scheduleDateTime}
                                format="DD-MM-YYYY hh:mm A"
                                onChange={val => setScheduleDateTime(val)}
                                sx={{ width: '100%', pb: 0, mb: 0 }}
                            />
                        </LocalizationProvider>
                        {typeof showScheduleTimeModal === "object" && <Typography variant="caption"><span style={{ color: "grey" }}>Current Schedule: </span>{showScheduleTimeModal?.existingSch}</Typography>}
                        {<Typography align='center' variant="caption"><span style={{ color: "grey" }}>Max Schedule: </span>{`${getLongDateTimeStr(maxDtLmt)}`}</Typography>}
                    </>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 5 }}>
                        <MUIButton
                            startIcon={typeof showScheduleTimeModal === "object" ? <UpdateOutlined /> : <SaveOutlined />}
                            onClick={() => {
                                if (typeof showScheduleTimeModal === "object") {
                                    changeCallSchedule();
                                } else {
                                    scheduleCalls();
                                }
                            }}
                        >
                            {typeof showScheduleTimeModal === "object" ? "Update" : "Save"}
                        </MUIButton>
                        <MUIButton startIcon={<CancelOutlined />} onClick={() => setShowScheduleTimeModal(false)}>Cancel</MUIButton>
                    </Box>
                </Box>
            </MUIModal>

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
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="h6">Success</Typography>
                    <Typography>{succMsg}</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
                        <MUIButton
                            onClick={() => {
                                setSuccOpen(false);
                            }}
                        >
                            OK
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>
        </Box>
    );
}
