import React, { useState } from 'react';
import BWButton from '../commonUI/BWButton';
import BWModal from '../commonUI/BWModal';
import BWInput from '../commonUI/BWInput';
import BoxFormLayout from '../commonUI/BoxFormLayout';
import CommonRetrieve from '../CommonCRUD/CommonRetrieve';
import CommonDelete from '../CommonCRUD/CommonDelete';
import CommonCreate from '../CommonCRUD/CommonCreate';
import usePersistentRows from '../../hooks/usePersistentRows';
import CandidateUpload from './CandidateUpload';

const parseResume = (url) => `Parsed info from ${url}`;

const CandidateForm = ({ initialValues = {}, onSubmit, onCancel }) => {
    const [data, setData] = useState({
        name: '',
        email: '',
        resumeUrl: '',
        skills: '',
        ...initialValues
    });

    const handle = (k) => (e) =>
        setData((p) => ({ ...p, [k]: e.target.value }));

    return (
        <BoxFormLayout>
            <CommonCreate
                title="Candidate Details"
                fields={[
                    {
                        field: (
                            <BWInput
                                fullWidth
                                label="Name"
                                value={data.name}
                                onChange={handle('name')}
                                sx={{ mb: 2 }}
                            />
                        )
                    },
                    {
                        field: (
                            <BWInput
                                fullWidth
                                label="Email"
                                type="email"
                                value={data.email}
                                onChange={handle('email')}
                                sx={{ mb: 2 }}
                            />
                        )
                    },
                    {
                        field: (
                            <BWInput
                                fullWidth
                                label="Resume URL"
                                type="url"
                                value={data.resumeUrl}
                                onChange={handle('resumeUrl')}
                                sx={{ mb: 2 }}
                            />
                        )
                    },
                    {
                        field: (
                            <BWInput
                                fullWidth
                                label="Skills (comma‑sep.)"
                                value={data.skills}
                                onChange={handle('skills')}
                                sx={{ mb: 3 }}
                            />
                        )
                    }
                ]}
                submitLabel="Save"
                onSubmit={() => onSubmit(data)}
                onCancel={onCancel}
            />
        </BoxFormLayout>
    );
};

const CandidateCRUD = () => {
    const [rows, setRows] = usePersistentRows('candidates');
    const [createOpen, setCreate] = useState(false);
    const [editOpen, setEdit] = useState(false);
    const [deleteOpen, setDelete] = useState(false);
    const [uploadOpen, setUpload] = useState(false);
    const [current, setCurrent] = useState(null);

    const columns = [
        { field: 'id', headerName: 'ID', width: 70 },
        { field: 'name', headerName: 'Name', width: 180 },
        { field: 'email', headerName: 'Email', width: 220 },
        { field: 'skills', headerName: 'Skills', width: 220 },
        { field: 'parsedInfo', headerName: 'Parsed', width: 240 }
    ];

    const nextId = () =>
        rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;

    const addRow = (d) => {
        const parsedInfo = parseResume(d.resumeUrl);
        setRows((p) => [...p, { id: nextId(), parsedInfo, ...d }]);
    };

    const updateRow = (d) =>
        setRows((p) => p.map((r) => (r.id === d.id ? d : r)));

    const deleteRow = () =>
        setRows((p) => p.filter((r) => r.id !== current.id));

    return (
        <>
            <BWButton sx={{ mb: 2 }} onClick={() => setCreate(true)}>
                Add Candidate
            </BWButton>

            <BWButton sx={{ mb: 2, ml: 2 }} onClick={() => setUpload(true)}>
                Upload Resume
            </BWButton>

            <CommonRetrieve
                title="Candidates"
                rows={rows}
                columns={columns}
                onEdit={(row) => {
                    setCurrent(row);
                    setEdit(true);
                }}
                onDelete={(row) => {
                    setCurrent(row);
                    setDelete(true);
                }}
            />

            <BWModal open={createOpen} onClose={() => setCreate(false)}>
                <CandidateForm
                    onSubmit={(d) => {
                        addRow(d);
                        setCreate(false);
                    }}
                    onCancel={() => setCreate(false)}
                />
            </BWModal>

            <BWModal open={editOpen} onClose={() => setEdit(false)}>
                <CandidateForm
                    initialValues={current || {}}
                    onSubmit={(d) => {
                        updateRow({ ...current, ...d });
                        setEdit(false);
                    }}
                    onCancel={() => setEdit(false)}
                />
            </BWModal>

            <CommonDelete
                open={deleteOpen}
                onClose={() => setDelete(false)}
                onConfirm={() => {
                    deleteRow();
                    setDelete(false);
                }}
                itemName={current?.name}
            />

            <CandidateUpload open={uploadOpen} onClose={() => setUpload(false)} />
        </>
    );
};

export default CandidateCRUD;