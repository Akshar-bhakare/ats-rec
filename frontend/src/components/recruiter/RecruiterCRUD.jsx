import { useState } from 'react';
import { MenuItem, InputAdornment, TextField } from '@mui/material';
import BWButton from '../commonUI/BWButton';
import BWModal from '../commonUI/BWModal';
import BWInput from '../commonUI/BWInput';
import BoxFormLayout from '../commonUI/BoxFormLayout';
import CommonRetrieve from '../CommonCRUD/CommonRetrieve';
import CommonDelete from '../CommonCRUD/CommonDelete';
import CommonCreate from '../CommonCRUD/CommonCreate';
import usePersistentRows from '../../hooks/usePersistentRows';
import { companies } from '../../data/dummyData';
import countryList from '../../assets/CountryCodes.json';  // ✅ Make sure this file exists and has country codes

const RecruiterForm = ({ initialValues = {}, onSubmit, onCancel }) => {
  const [data, setData] = useState({
    name: '',
    email: '',
    phone: '',
    countryCode: '+91',
    companyId: '',
    ...initialValues,
  });

  const handle = (k) => (e) => setData((p) => ({ ...p, [k]: e.target.value }));

  const fields = [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: 'Name *',
          value: data.name,
          onChange: handle('name'),
        },
        {
          type: 'email',
          name: 'email',
          label: 'Email *',
          value: data.email,
          onChange: handle('email'),
        },
      ],
    },
    {
      field: (
        <BWInput
          fullWidth
          label="Phone *"
          value={data.phone}
          onChange={handle('phone')}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <TextField
                  select
                  size="small"
                  name="countryCode"
                  value={data.countryCode || '+91'}
                  onChange={handle('countryCode')}
                  sx={{
                    minWidth: 80,
                    "& .MuiSelect-select": { padding: "6px 8px" },
                  }}
                >
                  {countryList.map((c) => (
                    <MenuItem key={c.code} value={c.dial_code}>
                      {c.name} ({c.dial_code})
                    </MenuItem>
                  ))}
                </TextField>
              </InputAdornment>
            ),
          }}
        />
      ),
    },
    {
      field: (
        <BWInput
          select
          fullWidth
          label="Company *"
          value={data.companyId}
          onChange={handle('companyId')}
          sx={{ mb: 3 }}
        >
          {companies.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </BWInput>
      ),
    },
  ];

  return (
    <BoxFormLayout>
      <CommonCreate
        title="Create Recruiter"
        fields={fields}
        submitLabel="Save"
        onSubmit={() => onSubmit(data)}
        onCancel={onCancel}
      />
    </BoxFormLayout>
  );
};

const RecruiterCRUD = () => {
  const [rows, setRows] = usePersistentRows('recruiters');
  const [createOpen, setCreate] = useState(false);
  const [editOpen, setEdit] = useState(false);
  const [deleteOpen, setDelete] = useState(false);
  const [current, setCurrent] = useState(null);

  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 180 },
    { field: 'email', headerName: 'Email', width: 220 },
    { field: 'phone', headerName: 'Phone', width: 160 },
    { field: 'phone', headerName: 'Phone', width: 160 },
    { field: 'companyId', headerName: 'Company', width: 140 },
  ];

  const nextId = () =>
    rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
  const addRow = (d) => setRows((p) => [...p, { id: nextId(), ...d }]);
  const updateRow = (d) => setRows((p) => p.map((r) => (r.id === d.id ? d : r)));
  const deleteRow = () => setRows((p) => p.filter((r) => r.id !== current.id));

  return (
    <>
      <BWButton sx={{ mb: 2 }} onClick={() => setCreate(true)}>
        Add Recruiter
      </BWButton>

      <CommonRetrieve
        title="Recruiters"
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
        <RecruiterForm
          onSubmit={(d) => {
            addRow(d);
            setCreate(false);
          }}
          onCancel={() => setCreate(false)}
        />
      </BWModal>

      <BWModal open={editOpen} onClose={() => setEdit(false)}>
        <RecruiterForm
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
    </>
  );
};

export default RecruiterCRUD;
