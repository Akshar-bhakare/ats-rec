import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Typography,
} from '@mui/material';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import { useParams, useNavigate } from 'react-router-dom';

import { fetchData } from '../../AppUtils/dataAPI';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import { useUiContextState } from '../../contexts/UiContext';

const CountCard = ({ title, value }) => (
    <Card sx={{ minWidth: 220, flex: '0 0 auto' }}>
        <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
                {title}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
                {value}
            </Typography>
        </CardContent>
    </Card>
);

const getSkillKeys = arr =>
    Array.isArray(arr)
        ? arr
            .flatMap(s =>
                typeof s === 'string'
                    ? [s]
                    : s && typeof s === 'object'
                        ? Object.keys(s)
                        : []
            )
            .join(', ')
        : arr ?? '—';

const norm = v => (v == null ? '' : String(v));
const isHexId = v => /^[a-fA-F0-9]{24}$/.test(norm(v));
const isCreatedLabel = val => {
    const s = norm(val).toLowerCase();
    return s === 'created' || s === 'create' || s === 'creation';
};

const getCreatorId = obj => {
    if (!obj) return null;

    if (obj.createdBy) {
        if (typeof obj.createdBy === 'object' && obj.createdBy._id) {
            return norm(obj.createdBy._id);
        }
        if (isHexId(obj.createdBy)) return norm(obj.createdBy);
    }

    if (obj.owner) {
        if (typeof obj.owner === 'object' && obj.owner._id) {
            return norm(obj.owner._id);
        }
        if (isHexId(obj.owner)) return norm(obj.owner);
    }

    const events = Array.isArray(obj.eventIds) ? obj.eventIds : [];
    if (!events.length) return null;

    for (const ev of events) {
        const label =
            ev?.eventName?.name ??
            ev?.eventName ??
            ev?.type ??
            ev?.action ?? '';
        if (isCreatedLabel(label)) {
            const uid =
                ev?.eventName?.userId?._id ??
                ev?.eventName?.userId ??
                ev?.userId ??
                ev?.actorId ??
                ev?.createdBy ?? null;
            if (uid) return norm(uid);
        }
    }

    let earliest = null;
    for (const ev of events) {
        const t = new Date(ev?.eventAt ?? ev?.createdAt ?? 0).getTime();
        const uid =
            ev?.eventName?.userId?._id ??
            ev?.eventName?.userId ??
            ev?.userId ??
            ev?.actorId ??
            ev?.createdBy ?? null;
        if (!earliest || t < earliest.t) earliest = { t, uid };
    }
    return earliest?.uid ? norm(earliest.uid) : null;
};

const isCreatedByUser = (obj, userId) => getCreatorId(obj) === norm(userId);

async function enrichWithEvents(list, buildUrl) {
    if (!Array.isArray(list) || !list.length) return [];
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const ids = list.map(x => x._id || x.id).filter(Boolean);
    const out = [];
    const chunkSize = 20;

    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const got = await Promise.all(
            chunk.map(async id => {
                try {
                    const url = buildUrl(id);
                    const res = await fetch(url, { headers });
                    if (!res.ok) throw new Error('fetch failed');
                    const obj = await res.json();
                    return { ...obj, _creatorId: getCreatorId(obj) };
                } catch {
                    const orig = list.find(x => (x._id || x.id) === id) || {};
                    return { ...orig, _creatorId: getCreatorId(orig) };
                }
            })
        );
        out.push(...got);
    }
    return out;
}

export default function DashboardDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [, setUiState] = useUiContextState();
    const [loading, setLoading] = useState(true);
    const [recruiter, setRecruiter] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [jobs, setJobs] = useState([]);

    useEffect(() => {
        if (!id) return;

        (async () => {
            setUiState({ loadingMsg: "Loading, Please wait..." });

            try {
                const user = await fetchData(`/api/users/${id}`);
                setRecruiter(user ?? null);
                if (!user) return;

                const recruiterId = String(user._id);
                const clientId = user.client ?? user._id;

                const [coList, caList, joList] = await Promise.all([
                    fetchData(`/api/companies?client=${clientId}`),
                    fetchData(`/api/candidates?client=${clientId}`),
                    fetchData(`/api/jobs?client=${clientId}`),
                ]);

                const [coEnriched, caEnriched, joEnriched] = await Promise.all([
                    enrichWithEvents(coList ?? [], (cid) => `/api/companies/${cid}?getEvents=true`),
                    enrichWithEvents(caList ?? [], (cid) => `/api/candidates/${cid}?getEvents=true`),
                    enrichWithEvents(joList ?? [], (jid) => `/api/jobs/${jid}?getEvents=true&resolveCompanies=true`),
                ]);

                const myCompanies = coEnriched.filter(o => isCreatedByUser(o, recruiterId));
                const myCandidates = caEnriched.filter(o => isCreatedByUser(o, recruiterId));
                const myJobs = joEnriched.filter(o => isCreatedByUser(o, recruiterId));

                setCompanies(myCompanies);
                setCandidates(myCandidates);
                setJobs(myJobs);
            } catch (err) {
                console.error('Recruiter‑detail fetch failed', err);
            } finally {
                setLoading(false);
                setUiState({ loadingMsg: null });
            }
        })();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    if (loading)
        return (
            <Box sx={{ mt: 8, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );

    if (!recruiter)
        return (
            <MUICenterLayout>
                <Typography>Recruiter not found.</Typography>
            </MUICenterLayout>
        );

    const companyRows = companies.map(c => ({
        id: c._id,
        name: c.name,
        industry: c.industry,
        size: c.size,
        website: c.website,
    }));
    const companyCols = [
        { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
        { field: 'industry', headerName: 'Industry', width: 130 },
        { field: 'size', headerName: 'Size', width: 80 },
        { field: 'website', headerName: 'Website', flex: 1, minWidth: 160 },
    ];

    const jobRows = jobs.map(j => ({
        id: j._id,
        title: j.title,
        company: j.company?.name ?? '—',
        type: j.jobType,
        mode: j.workMode,
    }));
    const jobCols = [
        { field: 'title', headerName: 'Title', flex: 1, minWidth: 80 },
        { field: 'company', headerName: 'Company', flex: 1, minWidth: 80 },
        { field: 'type', headerName: 'Type', width: 80 },
        { field: 'mode', headerName: 'Mode', width: 80 },
    ];

    const candRows = candidates.map(c => ({
        id: c._id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phoneNumber,
        skills: getSkillKeys(c.skills),
    }));
    const candCols = [
        { field: 'firstName', headerName: 'First Name', width: 140 },
        { field: 'lastName', headerName: 'Last Name', width: 140 },
        { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
        { field: 'phone', headerName: 'Phone', width: 140 },
        { field: 'skills', headerName: 'Skills', flex: 1, minWidth: 220 },
    ];

    return (
        <Box sx={{ p: 3 }}>
            <Button startIcon={<ArrowBackIosIcon />} sx={{ mb: 3 }} onClick={() => nav(-1)}>
                Back
            </Button>

            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                Recruiter Detail — {recruiter.firstName} {recruiter.lastName}
            </Typography>

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: 3,
                    mb: 5,
                }}
            >
                <CountCard title="Companies" value={companies.length} />
                <CountCard title="Candidates" value={candidates.length} />
                <CountCard title="Jobs" value={jobs.length} />
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', lg: 'row' },
                    gap: 2,
                    mb: 5,
                }}
            >
                <Box sx={{ flex: 1 }}>
                    <MUIRetrieveDataGrid
                        title="Companies"
                        rows={companyRows}
                        columns={companyCols}
                        hideToolbar
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <MUIRetrieveDataGrid
                        title="Jobs"
                        rows={jobRows}
                        columns={jobCols}
                        hideToolbar
                    />
                </Box>
            </Box>

            <MUIRetrieveDataGrid
                title="Candidates"
                rows={candRows}
                columns={candCols}
                hideToolbar
            />
        </Box>
    );
}
