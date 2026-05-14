import React, { useState } from 'react';
import BWButton from '../commonUI/BWButton';
import BWModal from '../commonUI/BWModal';
import BoxFormLayout from '../commonUI/BoxFormLayout';
import CommonRetrieve from '../CommonCRUD/CommonRetrieve';
import CommonDelete from '../CommonCRUD/CommonDelete';
import CommonCreate from '../CommonCRUD/CommonCreate';
import usePersistentRows from '../../hooks/usePersistentRows';

const ClientForm = ({ initialValues = {}, onSubmit, onCancel }) => {
    const [data, setData] = useState({
        clientName: '',
        industry: '',
        status: '',
        size: '',
        contactEmail: '',
        contactPhone: '',
        description: '',
        website: '',
        logoUrl: '',
        ...initialValues,
    });

    const handle = (k) => (e) => setData((p) => ({ ...p, [k]: e.target.value }));

    const fields = [
        {
            type: 'row',
            fields: [
                {
                    name: 'clientName',
                    label: 'Client Name *',
                    value: data.clientName,
                    onChange: handle('clientName'),
                },
                {
                    name: 'industry',
                    label: 'Industry *',
                    value: data.industry,
                    onChange: handle('industry'),
                },
            ],
        },
        {
            name: 'status',
            label: 'Status *',
            value: data.status,
            onChange: handle('status'),
            sx: { mb: 2 },
        },
        {
            type: 'number',
            name: 'size',
            label: 'Company Size *',
            value: data.size,
            onChange: handle('size'),
            sx: { mb: 2 },
        },
        {
            type: 'email',
            name: 'contactEmail',
            label: 'Contact Email *',
            value: data.contactEmail,
            onChange: handle('contactEmail'),
            sx: { mb: 2 },
        },
        {
            type: 'tel',
            name: 'contactPhone',
            label: 'Contact Phone *',
            value: data.contactPhone,
            onChange: handle('contactPhone'),
            sx: { mb: 2 },
        },
        {
            name: 'description',
            label: 'Description',
            value: data.description,
            onChange: handle('description'),
            sx: { mb: 2 },
        },
        {
            type: 'url',
            name: 'website',
            label: 'Website',
            value: data.website,
            onChange: handle('website'),
            sx: { mb: 2 },
        },
        {
            type: 'url',
            name: 'logoUrl',
            label: 'Logo URL',
            value: data.logoUrl,
            onChange: handle('logoUrl'),
            sx: { mb: 3 },
        },
    ];

    return (
        <BoxFormLayout>
            <CommonCreate
                title="Create Client"
                fields={fields}
                submitLabel="Save"
                onSubmit={() => onSubmit(data)}
                onCancel={onCancel}
            />
        </BoxFormLayout>
    );
};

const ClientAdminCRUD = () => {
    const [rows, setRows] = usePersistentRows('clientAdmins');
    const [createOpen, setCreate] = useState(false);
    const [editOpen, setEdit] = useState(false);
    const [deleteOpen, setDelete] = useState(false);
    const [current, setCurrent] = useState(null);

    const columns = [
        { field: 'id', headerName: 'ID', width: 70 },
        { field: 'clientName', headerName: 'Client', width: 180 },
        { field: 'industry', headerName: 'Industry', width: 140 },
        { field: 'status', headerName: 'Status', width: 120 },
        { field: 'size', headerName: 'Size', width: 100 },
        { field: 'contactEmail', headerName: 'Email', width: 200 },
        { field: 'contactPhone', headerName: 'Phone', width: 160 },
    ];

    const nextId = () =>
        rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
    const addRow = (d) => setRows((p) => [...p, { id: nextId(), ...d }]);
    const updateRow = (d) => setRows((p) => p.map((r) => (r.id === d.id ? d : r)));
    const deleteRow = () => setRows((p) => p.filter((r) => r.id !== current.id));

    return (
        <>
            <BWButton sx={{ mb: 2 }} onClick={() => setCreate(true)}>
                Add Client
            </BWButton>

            <CommonRetrieve
                title="Clients"
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
                <ClientForm
                    onSubmit={(d) => {
                        addRow(d);
                        setCreate(false);
                    }}
                    onCancel={() => setCreate(false)}
                />
            </BWModal>

            <BWModal open={editOpen} onClose={() => setEdit(false)}>
                <ClientForm
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
                itemName={current?.clientName}
            />
        </>
    );
};

export default ClientAdminCRUD;
