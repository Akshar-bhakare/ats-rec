import React, { useEffect, useMemo, useState } from 'react';
import {
    Card,
    CardContent,
    Box,
    TextField,
    Typography,
    Tooltip,
    IconButton,
    Tabs,
    Tab,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

import { fetchData } from '../../AppUtils/dataAPI';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import { useArchiveContextState } from '../../contexts/ArchiveContext';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useCandidateContextState } from '../../contexts/CandidateContext';
import { useJobContextState } from '../../contexts/JobContext';
import { useUiContextState } from '../../contexts/UiContext';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIAlert from '../MUI/commonUI/MUIAlert'; // ✅ ADDED

export default function ArchivedBin() {
    const [authState] = useAuthContextState();
    const [archiveState, setArchiveState] = useArchiveContextState();
    const [candidateState, setCandidateState] = useCandidateContextState();
    const [jobState, setJobState] = useJobContextState();
    const [, setUiState] = useUiContextState();
    const [tab, setTab] = useState(0);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [current, setCurrent] = useState(null);
    const [jobSearch, setJobSearch] = useState('');
    const [candSearch, setCandSearch] = useState('');
    const [interviewSearch, setInterviewSearch] = useState('');
    const [compSearch, setCompSearch] = useState('');
    const [stageSearch, setStageSearch] = useState('');
    const [recrSearch, setRecrSearch] = useState('');
    const [managerSearch, setManagerSearch] = useState('');
    const [interviewerSearch, setInterviewerSearch] = useState('');
    const [clientAdminSearch, setClientAdminSearch] = useState('');
    const [fltOpen, setFltOpen] = useState(false);
    const isClientAdmin = authState?.user?.role === 'client_admin';

    // ✅ ADDED: toast config for unarchive success/error
    const [alertCfg, setAlertCfg] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    const closeAlert = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertCfg(a => ({ ...a, open: false }));
    };

    const commColConfig = { flex: 1, flexGrow: 1, headerAlign: 'center' };

    const jobCols = useMemo(() => ([
        {
            field: 'id',
            headerName: 'ID',
            maxWidth: 70,
            sortable: false,
            filterable: false,
            renderCell: (params) =>
                params.api.getAllRowIds().indexOf(params.id) + 1,
            ...commColConfig,
        },
        { field: 'title', headerName: 'Title', minWidth: 300, ...commColConfig },
        {
            field: 'internalTitle',
            headerName: 'Internal Title',
            minWidth: 300,
            ...commColConfig,
        },
        {
            field: 'company',
            headerName: 'Company',
            minWidth: 200,
            renderCell: (params) => params.value?.name ?? '—',
            ...commColConfig,
        },
        { field: 'jobType', headerName: 'Type', minWidth: 120, ...commColConfig },
        { field: 'workMode', headerName: 'Mode', minWidth: 120, ...commColConfig },
        {
            field: 'createdByName',
            headerName: 'Created By',
            minWidth: 220,
            ...commColConfig,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), []);

    const candCols = useMemo(() => ([
        {
            field: 'sNo',
            headerName: 'S No.',
            maxWidth: 70,
            renderCell: (params) =>
                params.api.getAllRowIds().indexOf(params.id) + 1,
            ...commColConfig,
        },
        {
            field: 'firstName',
            headerName: 'First Name',
            minWidth: 140,
            ...commColConfig,
        },
        {
            field: 'lastName',
            headerName: 'Last Name',
            minWidth: 140,
            ...commColConfig,
        },
        { field: 'email', headerName: 'Email', minWidth: 200, ...commColConfig },
        {
            field: 'phoneNumber',
            headerName: 'Phone',
            minWidth: 140,
            ...commColConfig,
        },
        {
            field: 'jobApplied',
            headerName: 'Job Applied',
            minWidth: 200,
            ...commColConfig,
        },
        { field: 'skills', headerName: 'Skills', minWidth: 220, ...commColConfig },
        {
            field: 'uploadedBy',
            headerName: 'Uploaded By',
            minWidth: 180,
            ...commColConfig,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), []);

    const interviewCols = useMemo(() => ([
        {
            field: 'id',
            headerName: 'ID',
            maxWidth: 70,
            sortable: false,
            filterable: false,
            renderCell: (params) =>
                params.api.getAllRowIds().indexOf(params.id) + 1,
            ...commColConfig,
        },
        { field: 'candidateName', headerName: 'Candidate', minWidth: 200, ...commColConfig },
        { field: 'jobTitle', headerName: 'Job', minWidth: 200, ...commColConfig },
        {
            field: 'startAt',
            headerName: 'Start',
            minWidth: 200,
            valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : 'N/A',
            ...commColConfig,
        },
        { field: 'interviewMode', headerName: 'Mode', minWidth: 120, ...commColConfig },
        { field: 'interviewType', headerName: 'Type', minWidth: 140, ...commColConfig },
        { field: 'interviewerType', headerName: 'Interviewer', minWidth: 160, ...commColConfig },
        { field: 'interviewers', headerName: 'Interviewers', minWidth: 240, ...commColConfig },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), []);

    const compCols = useMemo(() => ([
        { field: 'id', headerName: 'ID', maxWidth: 70, ...commColConfig },
        { field: 'name', headerName: 'Name', minWidth: 200, ...commColConfig },
        {
            field: 'industry',
            headerName: 'Industry',
            minWidth: 160,
            ...commColConfig,
        },
        { field: 'size', headerName: 'Size', minWidth: 140, ...commColConfig },
        {
            field: 'website',
            headerName: 'Website',
            minWidth: 220,
            ...commColConfig,
        },
        {
            field: 'createdBy',
            headerName: 'Created By',
            minWidth: 200,
            ...commColConfig,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), []);

    const stageCols = useMemo(() => ([
        { field: 'id', headerName: 'ID', maxWidth: 70, ...commColConfig },
        {
            field: 'title',
            headerName: 'Stage Title',
            minWidth: 200,
            ...commColConfig,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), []);

    const recrCols = useMemo(() => ([
        { field: 'id', headerName: 'ID', maxWidth: 70, ...commColConfig },
        {
            field: 'firstName',
            headerName: 'First Name',
            minWidth: 160,
            ...commColConfig,
        },
        {
            field: 'lastName',
            headerName: 'Last Name',
            minWidth: 160,
            ...commColConfig,
        },
        { field: 'email', headerName: 'Email', minWidth: 240, ...commColConfig },
        {
            field: 'phoneNumber',
            headerName: 'Phone',
            minWidth: 160,
            ...commColConfig,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), []); // NEW

    const managerCols = useMemo(
        () =>
            recrCols.map(col => ({
                ...col,
                headerAlign: 'center',
                align: 'center',
            })),
        [recrCols]
    );

    const interviewerCols = useMemo(() => ([
        { field: 'id', headerName: 'ID', maxWidth: 70, ...commColConfig },
        {
            field: 'firstName',
            headerName: 'First Name',
            minWidth: 160,
            ...commColConfig,
        },
        {
            field: 'lastName',
            headerName: 'Last Name',
            minWidth: 160,
            ...commColConfig,
        },
        { field: 'email', headerName: 'Email', minWidth: 240, ...commColConfig },
        {
            field: 'phoneNumber',
            headerName: 'Phone',
            minWidth: 160,
            ...commColConfig,
        },
        {
            field: 'createdByName',
            headerName: 'Created By',
            minWidth: 200,
            ...commColConfig,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), []);

    const clientAdminCols = useMemo(() => ([
        { field: 'id', headerName: 'ID', maxWidth: 70, ...commColConfig },
        {
            field: 'firstName',
            headerName: 'First Name',
            minWidth: 160,
            ...commColConfig,
        },
        {
            field: 'lastName',
            headerName: 'Last Name',
            minWidth: 160,
            ...commColConfig,
        },
        { field: 'email', headerName: 'Email', minWidth: 240, ...commColConfig },
        {
            field: 'clientCompany',
            headerName: 'Client Company',
            minWidth: 200,
            ...commColConfig,
        },
        {
            field: 'totalCredit',
            headerName: 'AI Call Credit',
            minWidth: 120,
            ...commColConfig,
        },
        {
            field: 'videoInterviewCredit',
            headerName: 'Video Interview Credit',
            minWidth: 170,
            ...commColConfig,
        },
        {
            field: 'creditRatePerCall',
            headerName: 'Rate / Call',
            minWidth: 120,
            ...commColConfig,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]), []);

    const loadData = async () => {
        setUiState({ loadingMsg: 'Loading archived items, Please wait...' });
        try {
            let jobs = [];
            let cands = [];
            let interviews = [];
            let comps = [];
            let stgs = [];
            let recrs = [];
            let managers = [];
            let interviewers = [];
            let clientAdmins = [];

            // Jobs
            try {
                jobs = await fetchData('/api/jobs/archived?resolveCompanies=true');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived jobs:', error);
            }

            // Candidates
            try {
                cands = await fetchData('/api/candidates/archived');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived candidates:', error);
            }

            // Interviews
            try {
                interviews = await fetchData('/api/interviewschedules/archived');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived interviews:', error);
            }

            // Companies
            try {
                comps = await fetchData('/api/companies/archived');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived companies:', error);
            }

            // Stages
            try {
                stgs = await fetchData('/api/stages/archived');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived stages:', error);
            }

            // Recruiters
            try {
                recrs = await fetchData('/api/users/archived?role=recruiter');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived recruiters:', error);
            }

            // Managers
            try {
                managers = await fetchData('/api/users/archived?role=manager');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived managers:', error);
            }

            // Interviewers
            try {
                interviewers = await fetchData('/api/users/archived?role=interviewer');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived interviewers:', error);
            }

            // Client admins
            try {
                clientAdmins = await fetchData('/api/admins/archived');
            } catch (error) {
                console.error('[ArchivedBin] error in getting archived client admins:', error);
            }

            const jobRows = (jobs || []).map(j => ({
                ...j,
                id: j._id,
                __type: 'job',
                createdAt: j.createdAt?.substring(0, 10) || '',
            }));

            const candRows = (cands || []).map(c => ({
                ...c,
                id: c._id,
                __type: 'candidate',
                sNo: 0,
                jobApplied: c.jobApplied || '—',
                skills: Array.isArray(c.skills)
                    ? c.skills
                        .map(s =>
                            typeof s === 'string'
                                ? s
                                : Object.keys(s)[0]
                        )
                        .join(', ')
                    : (c.skills || '—'),
            }));

            const interviewRows = (interviews || []).map(i => ({
                ...i,
                id: i._id || i.id,
                __type: 'interview',
                candidateName: i?.candidate
                    ? `${i.candidate.firstName || ''} ${i.candidate.lastName || ''}`.trim() || i.candidate.email
                    : 'N/A',
                jobTitle: i?.job ? (i.job.title || i.job.internalTitle || 'N/A') : 'N/A',
                startAt: i.startAt || null,
                interviewMode: i.interviewMode || 'N/A',
                interviewType: i.interviewType || 'N/A',
                interviewerType: i.interviewerType || 'N/A',
                interviewers:
                    (i.interviewers || [])
                        .map(u => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email)
                        .join(', ') || 'N/A',
            }));

            const compRows = (comps || []).map(c => ({
                ...c,
                id: c._id || c.id,
                __type: 'company',
                createdAt:
                    c.createdAt?.substring?.(0, 10) ||
                    c.createdAt ||
                    '',
            }));

            const stageRows = (stgs || []).map(s => ({
                ...s,
                id: s._id || s.id,
                __type: 'stage',
                createdAt: s.createdAt?.substring?.(0, 10) || '',
            }));

            const recrRows = (recrs || []).map(r => ({
                ...r,
                id: r._id || r.id,
                __type: 'recruiter',
            }));

            const managerRows = (managers || []).map(r => ({
                ...r,
                id: r._id || r.id,
                __type: 'manager',
            }));

            const interviewerRows = (interviewers || []).map(r => ({
                ...r,
                id: r._id || r.id,
                __type: 'interviewer',
                createdByName: r.createdByName || r.createdBy || '',
            }));

            const clientAdminRows = (clientAdmins || []).map(ca => {
                const user = ca.user || {};
                return {
                    ...ca,
                    id: ca.client || user._id || ca._id,
                    __type: 'clientadmin',
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    email: user.email || '',
                    clientCompany: ca.clientCompany || '',
                    totalCredit: ca.totalCredit ?? 0,
                    videoInterviewCredit: ca.videoInterviewCredit ?? 0,
                    creditRatePerCall: ca.creditRatePerCall ?? 0,
                };
            });

            setArchiveState({
                archivedJobs: jobRows,
                archivedCandidates: candRows,
                archivedInterviews: interviewRows,
                archivedCompanies: compRows,
                archivedStages: stageRows,
                archivedRecruiters: recrRows,
                archivedManagers: managerRows,
                archivedInterviewers: interviewerRows,
                archivedClientAdmins: clientAdminRows,
            });
        } catch (e) {
            console.error('[ArchivedBin] loadData error:', e);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isClientAdmin && tab === 8) {
            setTab(0);
        }
    }, [isClientAdmin, tab]);

    const filteredJobs = useMemo(() => {
        const list = archiveState.archivedJobs || [];
        if (!jobSearch.trim()) return list;
        const q = jobSearch.toLowerCase();
        return list.filter(j =>
            (j.title || '').toLowerCase().includes(q) ||
            (j.internalTitle || '').toLowerCase().includes(q) ||
            (j.company?.name || '').toLowerCase().includes(q) ||
            (j.createdByName || '').toLowerCase().includes(q)
        );
    }, [archiveState.archivedJobs, jobSearch]);

    const filteredCandidates = useMemo(() => {
        const list = archiveState.archivedCandidates || [];
        if (!candSearch.trim()) {
            return list.map((r, idx) => ({ ...r, sNo: idx + 1 }));
        }
        const q = candSearch.toLowerCase();
        return list
            .map((r, idx) => ({ ...r, sNo: idx + 1 }))
            .filter(c =>
                [
                    c.firstName,
                    c.lastName,
                    c.email,
                    c.phoneNumber,
                    c.uploadedBy,
                    c.jobApplied,
                    c.skills,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                    .includes(q)
            );
    }, [archiveState.archivedCandidates, candSearch]);

    const filteredInterviews = useMemo(() => {
        const list = archiveState.archivedInterviews || [];
        if (!interviewSearch.trim()) return list;
        const q = interviewSearch.toLowerCase();
        return list.filter(i =>
            [
                i.candidateName,
                i.jobTitle,
                i.interviewMode,
                i.interviewType,
                i.interviewerType,
                i.interviewers,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [archiveState.archivedInterviews, interviewSearch]);

    const filteredCompanies = useMemo(() => {
        const list = archiveState.archivedCompanies || [];
        if (!compSearch.trim()) return list;
        const q = compSearch.toLowerCase();
        return list.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.industry || '').toLowerCase().includes(q) ||
            (c.size || '').toLowerCase().includes(q) ||
            (c.website || '').toLowerCase().includes(q) ||
            (c.createdBy || '').toLowerCase().includes(q)
        );
    }, [archiveState.archivedCompanies, compSearch]);

    const filteredStages = useMemo(() => {
        const list = archiveState.archivedStages || [];
        if (!stageSearch.trim()) return list;
        const q = stageSearch.toLowerCase();
        return list.filter(s =>
            (s.title || '').toLowerCase().includes(q)
        );
    }, [archiveState.archivedStages, stageSearch]);

    const filteredRecruiters = useMemo(() => {
        const list = archiveState.archivedRecruiters || [];
        if (!recrSearch.trim()) return list;
        const q = recrSearch.toLowerCase();
        return list.filter(r =>
            [
                r.firstName,
                r.lastName,
                r.email,
                r.phoneNumber,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [archiveState.archivedRecruiters, recrSearch]);

    const filteredManagers = useMemo(() => {
        const list = archiveState.archivedManagers || [];
        if (!managerSearch.trim()) return list;
        const q = managerSearch.toLowerCase();
        return list.filter(r =>
            [
                r.firstName,
                r.lastName,
                r.email,
                r.phoneNumber,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [archiveState.archivedManagers, managerSearch]);

    const filteredInterviewers = useMemo(() => {
        const list = archiveState.archivedInterviewers || [];
        if (!interviewerSearch.trim()) return list;
        const q = interviewerSearch.toLowerCase();
        return list.filter(r =>
            [
                r.firstName,
                r.lastName,
                r.email,
                r.phoneNumber,
                r.createdByName,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [archiveState.archivedInterviewers, interviewerSearch]);

    const filteredClientAdmins = useMemo(() => {
        const list = archiveState.archivedClientAdmins || [];
        if (!clientAdminSearch.trim()) return list;
        const q = clientAdminSearch.toLowerCase();
        return list.filter(r =>
            [
                r.firstName,
                r.lastName,
                r.email,
                r.clientCompany,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [archiveState.archivedClientAdmins, clientAdminSearch]);

    const unarchiveRow = async () => {
        setUiState({ loadingMsg: 'Restoring, Please wait...' });

        const typeLabel =
            current?.__type === 'job' ? 'Job'
                : current?.__type === 'candidate' ? 'Candidate'
                    : current?.__type === 'interview' ? 'Interview'
                        : current?.__type === 'company' ? 'Company'
                            : current?.__type === 'stage' ? 'Stage'
                                : current?.__type === 'interviewer' ? 'Interviewer'
                                    : current?.__type === 'recruiter' ? 'Recruiter'
                                        : current?.__type === 'manager' ? 'Manager'
                                        : current?.__type === 'clientadmin' ? 'Client admin'
                                            : 'Item';

        let apiOk = true;

        try {
            let resp;

            try {
                if (current?.__type === 'candidate') {
                    resp = await fetchData(
                        `/api/candidates/${current.id}/unarchive`,
                        { method: 'PUT' }
                    );
                } else if (current?.__type === 'interview') {
                    resp = await fetchData(
                        `/api/interviewschedules/${current.id}/unarchive`,
                        { method: 'PUT' }
                    );
                } else if (current?.__type === 'company') {
                    resp = await fetchData(
                        `/api/companies/${current.id}/unarchive`,
                        { method: 'PUT' }
                    );
                } else if (current?.__type === 'stage') {
                    resp = await fetchData(
                        `/api/stages/${current.id}/unarchive`,
                        { method: 'PUT' }
                    );
                } else if (
                    current?.__type === 'recruiter' ||
                    current?.__type === 'interviewer' ||
                    current?.__type === 'manager'
                ) {
                    resp = await fetchData(
                        `/api/users/${current.id}/unarchive`,
                        { method: 'PUT' }
                    );
                } else if (current?.__type === 'clientadmin') {
                    resp = await fetchData(
                        `/api/admins/${current.id}/unarchive`,
                        { method: 'PUT' }
                    );
                } else {
                    resp = await fetchData(
                        `/api/jobs/${current.id}/unarchive`,
                        { method: 'PUT' }
                    );
                    console.log('[ArchivedBin] unarchive job response:', resp);
                }
            } catch (err) {
                apiOk = false;
                console.error('[ArchivedBin] unarchive API call error:', err);
            }

            // Refresh live lists
            try {
                if (current?.__type === 'job') {
                    const view = jobState?.jobsListViewMode || 'me';
                    let jobs = [];
                    try {
                        jobs = await fetchData(
                            `/api/jobs/?resolveCompanies=true&viewMode=${view}`
                        );
                    } catch (err) {
                        console.error('[ArchivedBin] refresh jobs list error:', err);
                    }

                    const jobRows = (jobs || []).map(j => ({
                        ...j,
                        id: j._id,
                        createdAt: j.createdAt?.substring(0, 10) || '',
                    }));

                    setJobState({
                        jobRowsList: jobRows,
                        jobsListViewMode: view,
                    });
                } else if (current?.__type === 'candidate') {
                    const view = candidateState?.candidatesListViewMode || 'me';
                    let cands = [];
                    try {
                        cands = await fetchData(`/api/candidates/?viewMode=${view}`);
                    } catch (err) {
                        console.error('[ArchivedBin] refresh candidates list error:', err);
                    }

                    const candRows = (cands || []).map(c => ({
                        ...c,
                        createdAt: c.createdAt?.substring(0, 10) || '',
                    }));

                    setCandidateState({
                        candidateListRows: candRows,
                        candidatesListViewMode: view,
                    });
                }
            } catch (e) {
                console.warn('[ArchivedBin] live list refresh failed:', e);
            }

            // ✅ ADDED: success/error message (same UX pattern as archive)
            if (apiOk) {
                setAlertCfg({
                    open: true,
                    message: `${typeLabel} unarchived.`,
                    severity: 'success',
                });
            } else {
                setAlertCfg({
                    open: true,
                    message: `Failed to unarchive ${typeLabel}.`,
                    severity: 'error',
                });
            }
        } catch (e) {
            console.error('[ArchivedBin] unarchive error:', e);
            setAlertCfg({
                open: true,
                message: `Failed to unarchive ${typeLabel}.`,
                severity: 'error',
            });
        } finally {
            setConfirmOpen(false);
            setUiState({ loadingMsg: null });
            await loadData();
        }
    };

    return (
        <Card sx={{ m: { xs: 0, sm: 2, md: 3 }, p: { xs: 1.5, sm: 2 } }}>
            <CardContent>
                {/* ✅ ADDED: toast surface */}
                <MUIAlert
                    open={alertCfg.open}
                    message={alertCfg.message}
                    severity={alertCfg.severity}
                    onClose={closeAlert}
                />

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                    >
                        <Tab label="Archived Jobs" />
                        <Tab label="Archived Candidates" />
                        <Tab label="Archived Interviews" />
                        <Tab label="Archived Company" />
                        <Tab label="Archived Stages" />
                        <Tab label="Archived Client Admins" />
                        <Tab label="Archived Interviewers" />
                        <Tab label="Archived Recruiters" />
                        {isClientAdmin && <Tab label="Archived Managers" />}
                    </Tabs>
                </Box>

                {tab === 0 && (
                    <Box sx={{ mb: 3 }}>
                        <MUIRetrieveDataGrid
                            title="Archived Jobs"
                            rows={filteredJobs}
                            columns={jobCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'job',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Jobs"
                                        variant="outlined"
                                        size="small"
                                        value={jobSearch}
                                        onChange={e =>
                                            setJobSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                {tab === 1 && (
                    <Box>
                        <MUIRetrieveDataGrid
                            title="Archived Candidates"
                            rows={filteredCandidates}
                            columns={candCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'candidate',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Candidates"
                                        variant="outlined"
                                        size="small"
                                        value={candSearch}
                                        onChange={e =>
                                            setCandSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                {tab === 2 && (
                    <Box>
                        <MUIRetrieveDataGrid
                            title="Archived Interviews"
                            rows={filteredInterviews}
                            columns={interviewCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'interview',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Interviews"
                                        variant="outlined"
                                        size="small"
                                        value={interviewSearch}
                                        onChange={e =>
                                            setInterviewSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                {tab === 3 && (
                    <Box>
                        <MUIRetrieveDataGrid
                            title="Archived Company"
                            rows={filteredCompanies}
                            columns={compCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'company',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Companies"
                                        variant="outlined"
                                        size="small"
                                        value={compSearch}
                                        onChange={e =>
                                            setCompSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                {tab === 4 && (
                    <Box>
                        <MUIRetrieveDataGrid
                            title="Archived Stages"
                            rows={filteredStages}
                            columns={stageCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'stage',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Stages"
                                        variant="outlined"
                                        size="small"
                                        value={stageSearch}
                                        onChange={e =>
                                            setStageSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                {tab === 5 && (
                    <Box>
                        <MUIRetrieveDataGrid
                            title="Archived Client Admins"
                            rows={filteredClientAdmins}
                            columns={clientAdminCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'clientadmin',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Client Admins"
                                        variant="outlined"
                                        size="small"
                                        value={clientAdminSearch}
                                        onChange={e =>
                                            setClientAdminSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                {tab === 6 && (
                    <Box>
                        <MUIRetrieveDataGrid
                            title="Archived Interviewers"
                            rows={filteredInterviewers}
                            columns={interviewerCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'interviewer',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Interviewers"
                                        variant="outlined"
                                        size="small"
                                        value={interviewerSearch}
                                        onChange={e =>
                                            setInterviewerSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                {tab === 7 && (
                    <Box>
                        <MUIRetrieveDataGrid
                            title="Archived Recruiters"
                            rows={filteredRecruiters}
                            columns={recrCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'recruiter',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Recruiters"
                                        variant="outlined"
                                        size="small"
                                        value={recrSearch}
                                        onChange={e =>
                                            setRecrSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                {isClientAdmin && tab === 8 && (
                    <Box>
                        <MUIRetrieveDataGrid
                            title="Archived Managers"
                            rows={filteredManagers}
                            columns={managerCols}
                            hideBuiltInActions
                            customActionsRenderer={(params) => (
                                <MUIButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrent({
                                            ...params.row,
                                            __type: 'manager',
                                        });
                                        setConfirmOpen(true);
                                    }}
                                >
                                    Unarchive
                                </MUIButton>
                            )}
                            createButton={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TextField
                                        label="Search Archived Managers"
                                        variant="outlined"
                                        size="small"
                                        value={managerSearch}
                                        onChange={e =>
                                            setManagerSearch(e.target.value)
                                        }
                                    />
                                    <Tooltip title="Filter">
                                        <IconButton
                                            onClick={() => setFltOpen(true)}
                                        >
                                            <FilterListIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        />
                    </Box>
                )}

                <MUIArchiveCnfModal
                    open={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    onConfirm={unarchiveRow}
                    itemName={
                        current?.__type === 'candidate'
                            ? (`${current?.firstName ?? ''} ${current?.lastName ?? ''}`.trim() || current?.email)
                            : current?.__type === 'interview'
                                ? current?.candidateName || current?.jobTitle || 'Interview'
                                : current?.__type === 'company'
                                    ? current?.name
                                    : current?.__type === 'stage'
                                        ? current?.title
                                        : current?.__type === 'interviewer'
                                            ? (`${current?.firstName ?? ''} ${current?.lastName ?? ''}`.trim() || current?.email)
                                            : current?.__type === 'recruiter'
                                                ? (`${current?.firstName ?? ''} ${current?.lastName ?? ''}`.trim() || current?.email)
                                                : current?.__type === 'manager'
                                                    ? (`${current?.firstName ?? ''} ${current?.lastName ?? ''}`.trim() || current?.email)
                                                : current?.__type === 'clientadmin'
                                                    ? (`${current?.firstName ?? ''} ${current?.lastName ?? ''}`.trim() || current?.email)
                                                    : current?.internalTitle || current?.title
                    }
                    actionName="Unarchive"
                />

                <MUIModal open={fltOpen} onClose={() => setFltOpen(false)}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6">
                            Filter (simple)
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            Use the search box above each tab to quickly
                            find archived items.
                        </Typography>
                    </Box>
                </MUIModal>
            </CardContent>
        </Card>
    );
}

