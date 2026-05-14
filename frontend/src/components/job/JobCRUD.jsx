import React, { useState } from 'react';
import { Box, Chip, Checkbox, FormControlLabel, TextField } from '@mui/material';
import BWButton from '../commonUI/BWButton';
import BWModal from '../commonUI/BWModal';
import BWInput from '../commonUI/BWInput';
import BoxFormLayout from '../commonUI/BoxFormLayout';
import CommonRetrieve from '../CommonCRUD/CommonRetrieve';
import CommonDelete from '../CommonCRUD/CommonDelete';
import usePersistentRows from '../../hooks/usePersistentRows';

const generateJD = t => `${t} – This is an auto-generated job description.`;

const levelOpts = ['Schooling', 'Bachelors', 'Masters'];
const degreeOpts = {
    Schooling: ['SSC', 'HSC'],
    Bachelors: ['B.Tech', 'B.Sc', 'B.CS', 'Others'],
    Masters: ['M.Tech', 'M.Sc', 'Others']
};

const tier1Colleges = ['IIT Bombay', 'IIT Delhi', 'IIT Madras'];
const tier2Colleges = ['BITS Pilani', 'COEP Pune', 'VIT Vellore'];
const tier3Colleges = ['Local University', 'Open University', 'State College'];

const jobTypeOpts = ['Full-time', 'Contract', 'Internship'];
const workModeOpts = ['On-site', 'Hybrid', 'Remote'];
const languageOpt = ['English (United States)', 'English (United Kingdom)'];

const scriptTypeOpts = ['AI Call', 'Email', 'SMS'];
const scriptJobOpts = ['Job-1'];                       // placeholder

const JobWizard = ({ initialValues = {}, onSubmit, onCancel }) => {
    const [step, setStep] = useState(0);
    const next = () => setStep(s => Math.min(3, s + 1));
    const back = () => setStep(s => Math.max(0, s - 1));

    const [data, setData] = useState({
        title: '', company: '', positions: '',
        jobType: '', workMode: '', isRemote: false,
        locations: [], locationInput: '',
        minSalary: '', maxSalary: '', minExp: '', maxExp: '',
        educations: [{ level: '', degree: '', institute: '', field: '', score: '', college: '' }],
        skills: [], skillInput: '', booleanString: '',
        description: '', notes: '',
        scriptJob: '', scriptName: '', scriptType: 'AI Call',
        scriptExtra: '', scriptContent: '', scriptLang: '', scriptVoice: '',
        ...initialValues,
    });

    const change = key => e => setData(p => ({ ...p, [key]: e.target.value }));
    const sanitizeDigits = value => value.replace(/[^\d]/g, '');
    const changeDigitsOnly = key => e =>
        setData(p => ({ ...p, [key]: sanitizeDigits(e.target.value) }));
    const blockNonDigitKeys = e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab'];
        if (allowed.includes(e.key)) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
    };
    const addTag = (k, v) =>
        setData(p => (v && !p[k].includes(v) ? { ...p, [k]: [...p[k], v] } : p));
    const rmTag = (k, v) =>
        setData(p => ({ ...p, [k]: p[k].filter(x => x !== v) }));
    const [collegeRow, setCollegeRow] = useState(-1);
    const [collegePick, setCollegePick] = useState({});
    const closeCollege = () => { setCollegeRow(-1); setCollegePick({}); };
    const confirmCollege = () => {
        const chosen = Object.keys(collegePick).find(c => collegePick[c]) || '';
        setData(p => ({
            ...p,
            educations: p.educations?.map?.((e, i) =>
                i === collegeRow ? { ...e, college: chosen } : e)
        }));
        closeCollege();
    };
    const tierCB = c => (
        <FormControlLabel
            key={c}
            control={
                <Checkbox
                    checked={collegePick[c] || false}
                    onChange={(_, v) => setCollegePick(p => ({ ...p, [c]: v }))}
                />
            }
            label={c}
        />
    );

    const StepBasic = (
        <>
            <BWInput fullWidth label="Job Title" value={data.title}
                onChange={change('title')} sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <BWInput fullWidth label="Company"
                    value={data.company} onChange={change('company')} />
                <BWInput fullWidth label="Positions" type="number"
                    value={data.positions} onChange={change('positions')} />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <BWInput fullWidth label="Job Type" options={jobTypeOpts}
                    value={data.jobType} onChange={change('jobType')} />
                <BWInput fullWidth label="Work Mode" options={workModeOpts}
                    value={data.workMode} onChange={change('workMode')} />
            </Box>

            <BWInput fullWidth label="Type a location and press Enter"
                value={data.locationInput}
                onChange={e => setData(p => ({ ...p, locationInput: e.target.value }))}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag('locations', data.locationInput.trim());
                        setData(p => ({ ...p, locationInput: '' }));
                    }
                }} sx={{ mb: 1 }} />

            <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {data.locations.map(loc => (
                    <Chip key={loc} label={loc} onDelete={() => rmTag('locations', loc)} />
                ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField fullWidth label="Min Salary" type="number"
                    value={data.minSalary}
                    onChange={changeDigitsOnly('minSalary')}
                    onKeyDown={blockNonDigitKeys}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} />
                <TextField fullWidth label="Max Salary" type="number"
                    value={data.maxSalary}
                    onChange={changeDigitsOnly('maxSalary')}
                    onKeyDown={blockNonDigitKeys}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <BWInput fullWidth label="Min Experience (yrs)" type="number"
                    value={data.minExp} onChange={change('minExp')} />
                <BWInput fullWidth label="Max Experience (yrs)" type="number"
                    value={data.maxExp} onChange={change('maxExp')} />
            </Box>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <input type="checkbox" checked={data.isRemote}
                    onChange={e => setData(p => ({ ...p, isRemote: e.target.checked }))} />
                Remote position
            </label>
        </>
    );

    const updateEdu = (i, k) => e =>
        setData(p => ({
            ...p,
            educations: p.educations?.map?.((ed, idx) =>
                idx === i ? { ...ed, [k]: e.target.value } : ed)
        }));
    const addEdu = () => setData(p => ({
        ...p,
        educations: [...p.educations,
        { level: '', degree: '', institute: '', field: '', score: '', college: '' }]
    }));
    const removeEdu = idx =>
        setData(p => ({ ...p, educations: p.educations?.filter?.((_, i) => i !== idx) }));

    const EduCard = (ed, idx) => (
        <Box key={idx}
            sx={{
                mb: 3, p: 3, border: '1px solid #ccc', borderRadius: 2,
                background: '#fafafa'
            }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <BWInput
                    label="Education Level"
                    options={levelOpts}
                    value={ed.level}
                    onChange={updateEdu(idx, 'level')}
                    sx={{ flexGrow: 1 }}
                />
                <BWInput
                    label="Education / Degree"
                    options={degreeOpts[ed.level] || []}
                    value={ed.degree}
                    onChange={updateEdu(idx, 'degree')}
                    sx={{ flexGrow: 1 }}
                />
                {Number(data?.educations?.length) > 1 && (
                    <BWButton size="small" variant="outlined"
                        onClick={() => removeEdu(idx)}>
                        Remove
                    </BWButton>
                )}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <BWInput
                    fullWidth
                    label={ed.level === 'Schooling' ? 'School' : 'College'}
                    value={ed.institute}
                    onChange={updateEdu(idx, 'institute')}
                    sx={{ flexGrow: 1 }}
                />
                {(ed.level === 'Bachelors' || ed.level === 'Masters') && (
                    <BWButton onClick={() => setCollegeRow(idx)}
                        sx={{ whiteSpace: 'nowrap', height: '56px' }}>
                        Pick College
                    </BWButton>
                )}
            </Box>

            {ed.college && (
                <Box sx={{ mb: 2, fontStyle: 'italic' }}>
                    Chosen College:&nbsp;<strong>{ed.college}</strong>
                </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <BWInput
                    fullWidth label="Field / Stream"
                    value={ed.field}
                    onChange={updateEdu(idx, 'field')}
                    sx={{ flexGrow: 1 }}
                />
                <BWInput
                    fullWidth label="% / CGPA"
                    value={ed.score}
                    onChange={updateEdu(idx, 'score')}
                    sx={{ flexGrow: 1 }}
                />
            </Box>
        </Box>
    );

    const StepEdu = (
        <>
            {data.educations?.map?.(EduCard)}
            <BWButton onClick={addEdu}>Add Education</BWButton>

            <BWModal open={collegeRow > -1} onClose={closeCollege}>
                <Box sx={{ p: 3, minWidth: 300 }}>
                    <h3>Select College</h3>
                    <p>Tier 1</p>{tier1Colleges.map(tierCB)}
                    <p>Tier 2</p>{tier2Colleges.map(tierCB)}
                    <p>Tier 3</p>{tier3Colleges.map(tierCB)}
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <BWButton fullWidth onClick={confirmCollege}>Confirm</BWButton>
                        <BWButton fullWidth onClick={closeCollege}
                            sx={{ background: 'transparent', border: '1px solid' }}>
                            Cancel
                        </BWButton>
                    </Box>
                </Box>
            </BWModal>
        </>
    );

    const StepSkillsJD = (
        <>
            <h3 style={{ margin: '4px 0 8px' }}>Skills &amp; Boolean Search</h3>

            <BWInput fullWidth label="Type a skill and press Enter*"
                value={data.skillInput}
                onChange={e => setData(p => ({ ...p, skillInput: e.target.value }))}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag('skills', data.skillInput.trim());
                        setData(p => ({ ...p, skillInput: '' }));
                    }
                }} sx={{ mb: 2 }} />

            <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {data.skills.map(s => (
                    <Chip key={s} label={s} onDelete={() => rmTag('skills', s)} />
                ))}
            </Box>

            <BWButton fullWidth sx={{ mb: 4 }}
                onClick={() => setData(p => ({
                    ...p, booleanString: `("${p.skills.join('" OR "')}")`
                }))}>
                Generate Boolean String
            </BWButton>

            <h3 style={{ margin: '4px 0 8px' }}>Job Description*</h3>
            <BWInput fullWidth multiline rows={4}
                value={data.description} onChange={change('description')}
                sx={{ mb: 2 }} />

            <BWButton sx={{ mb: 4 }}
                onClick={() => setData(p => ({
                    ...p, description: generateJD(p.title || 'Job')
                }))}>
                Generate with AI
            </BWButton>

            <BWInput fullWidth multiline rows={2}
                label="Recruiter Notes (private)"
                value={data.notes} onChange={change('notes')} />
        </>
    );

    const StepScript = (
        <>
            <BWInput fullWidth label="Script for Job*"
                options={scriptJobOpts}
                value={data.scriptJob} onChange={change('scriptJob')}
                sx={{ mb: 2 }} />

            <BWInput fullWidth label="Script Name*"
                value={data.scriptName} onChange={change('scriptName')}
                sx={{ mb: 2 }} />

            <BWInput fullWidth label="Script Type*"
                options={scriptTypeOpts}
                value={data.scriptType} onChange={change('scriptType')}
                sx={{ mb: 2 }} />

            <BWInput fullWidth label="Extra Question"
                value={data.scriptExtra} onChange={change('scriptExtra')}
                sx={{ mb: 2 }} />

            <BWInput fullWidth multiline rows={4} label="Content*"
                value={data.scriptContent} onChange={change('scriptContent')}
                sx={{ mb: 2 }} />

            <BWButton sx={{ mb: 2 }}
                onClick={() => setData(p => ({
                    ...p, scriptContent: `AI-generated script for ${p.scriptName || 'Job'}`
                }))}>
                Generate with AI
            </BWButton>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <BWInput fullWidth label="Language*"
                    options={languageOpt}
                    value={data.scriptLang} onChange={change('scriptLang')} />
                <BWInput fullWidth label="Voice Model*"
                    value={data.scriptVoice} onChange={change('scriptVoice')} />
            </Box>
        </>
    );

    const steps = [StepBasic, StepEdu, StepSkillsJD, StepScript];
    const isLast = step === steps.length - 1;

    return (
        <BoxFormLayout title="Create Job"
            onSubmit={e => { e.preventDefault(); isLast ? onSubmit(data) : next(); }}>
            {steps[step]}

            <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
                {step > 0
                    ? <BWButton fullWidth onClick={back}>Back</BWButton>
                    : <Box sx={{ flex: 1 }} />}
                <BWButton fullWidth onClick={onCancel}
                    sx={{
                        background: 'transparent', border: '1px solid',
                        color: 'text.primary', '&:hover': { background: 'action.hover' }
                    }}>
                    Cancel
                </BWButton>
                <BWButton type="submit" fullWidth>
                    {isLast ? 'Finish' : 'Next'}
                </BWButton>

            </Box>
        </BoxFormLayout>
    );
};

const JobCRUD = () => {
    const [rows, setRows] = usePersistentRows('jobs');
    const [createO, setC] = useState(false);
    const [editO, setE] = useState(false);
    const [delO, setD] = useState(false);
    const [current, setCur] = useState(null);

    const cols = [
        { field: 'id', headerName: 'ID', width: 70 },
        { field: 'title', headerName: 'Title', width: 200 },
        { field: 'company', headerName: 'Company', width: 160 },
        { field: 'jobType', headerName: 'Type', width: 120 },
        { field: 'workMode', headerName: 'Mode', width: 120 },
        { field: 'isRemote', headerName: 'Remote', width: 100, type: 'boolean' },
    ];

    const nextId = () => rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    const addRow = d => setRows(p => [...p, { id: nextId(), ...d }]);
    const updateRow = d => setRows(p => p.map(r => r.id === d.id ? d : r));
    const deleteRow = () => setRows(p => p.filter(r => r.id !== current.id));

    return (
        <>
            <BWButton sx={{ mb: 2 }} onClick={() => setC(true)}>Add Job</BWButton>

            <CommonRetrieve
                title="Jobs"
                rows={rows}
                columns={cols}
                onEdit={row => { setCur(row); setE(true); }}
                onDelete={row => { setCur(row); setD(true); }}
            />

            <BWModal open={createO} onClose={() => setC(false)}>
                <JobWizard onSubmit={d => { addRow(d); setC(false); }}
                    onCancel={() => setC(false)} />
            </BWModal>

            <BWModal open={editO} onClose={() => setE(false)}>
                <JobWizard initialValues={current || {}}
                    onSubmit={d => { updateRow({ ...current, ...d }); setE(false); }}
                    onCancel={() => setE(false)} />
            </BWModal>

            <CommonDelete open={delO} onClose={() => setD(false)}
                onConfirm={() => { deleteRow(); setD(false); }}
                itemName={current?.title} />
        </>
    );
};

export default JobCRUD;
