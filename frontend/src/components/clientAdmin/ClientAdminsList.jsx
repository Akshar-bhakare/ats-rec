import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@mui/material';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import { useNavigate } from 'react-router-dom';
import { useClientAdminContextState } from '../../contexts/ClientAdminContext';
import { useUiContextState } from '../../contexts/UiContext';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';

export default function ClientAdminsList() {
    const [, setClientAdminState] = useClientAdminContextState();
    const [, setUiState] = useUiContextState();
    const [rows, setRows] = useState([]);
    const [delOpen, setDel] = useState(false);
    const [current, setCur] = useState(null);
    const nav = useNavigate();

    const loadAdmins = () => {
        setUiState({
            loadingMsg: "Loading, Please wait..."
        });
        fetchData('/api/admins')
            .then(list => {
                // console.log('[ClientAdminsList] /api/admins ->', list);
                if (!Array.isArray(list)) return;

                const mapped = list
                    .filter(ca => !ca.isArchived)
                    .map((ca, idx) => ({
                        id: ca._id,
                        sn: idx + 1,
                        firstName: ca.user?.firstName || '',
                        lastName: ca.user?.lastName || '',
                        email: ca.user?.email || '',
                        phoneNumber: ca.user?.phoneNumber || '',
                        clientCompany: ca.clientCompany || '',
                        totalCredit: ca.totalCredit ?? 0,
                        videoInterviewCredit: ca.videoInterviewCredit ?? 0,
                        creditRatePerCall: ca.creditRatePerCall ?? 0
                    }));

                setRows(mapped);
            })
            .catch(err => console.error('ClientAdmin fetch failed:', err))
            .finally(() => {

                setUiState({
                    loadingMsg: null,
                });

            });

    }

    useEffect(() => {
        loadAdmins();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const cols = [
        { field: 'sn', headerName: '#', width: 60, headerAlign: 'center', align: 'center' },
        { field: 'firstName', headerName: 'First Name', width: 150 },
        { field: 'lastName', headerName: 'Last Name', width: 150 },
        { field: 'email', headerName: 'Email', width: 230 },
        { field: 'clientCompany', headerName: 'Client Company', width: 180 },
        { field: 'totalCredit', headerName: 'AI Call Credit', width: 130, headerAlign: 'center', align: 'center' },
        { field: 'videoInterviewCredit', headerName: 'Video Interview Credit', width: 160, headerAlign: 'center', align: 'center' },
        { field: 'creditRatePerCall', headerName: 'Rate / Call', width: 120, headerAlign: 'center', align: 'center' },
    ];

    const destroy = () => {

        setUiState({
            loadingMsg: "Loading, Please wait..."
        });

        fetchData(`/api/admins/${current.id}`, { method: 'DELETE' })
            .then(() => setRows(r => r.filter(x => x.id !== current.id)))
            .finally(() => {
                setDel(false);

                setUiState({
                    loadingMsg: null,
                });

            });
    };

    return (
        <Card
            sx={{
                px: { xs: 2, sm: 3, md: 5 },
                pt: { xs: 1, sm: 1.5, md: 2 },
                pb: { xs: 2, sm: 3, md: 5 },
                mx: { xs: 0, sm: "1vw" },
                my: { xs: 0, sm: 0.5 },
                minHeight: "80vh"
            }}
        >
            <CardContent>
                <MUIRetrieveDataGrid
                    title="Client Admins"
                    onRefresh={() => loadAdmins()}
                    rows={rows}
                    columns={cols}
                    onRowClick={row => nav(`/admins/${row.id}`)}
                    onEdit={row => {
                        setCur(row);
                        setClientAdminState({ clientAdminInitialValuesDict: row });
                        nav('/admins/new');
                    }}
                    onDelete={row => { setCur(row); setDel(true); }}
                    createButton={
                        <MUIButton
                            onClick={() => {
                                setClientAdminState({ clientAdminInitialValuesDict: null });
                                nav('/admins/new');
                            }}
                        >
                            <AddBusinessRoundedIcon sx={{ mr: 1 }} />
                            New Client Admin
                        </MUIButton>
                    }
                />

                <MUIArchiveCnfModal
                    open={delOpen}
                    onClose={() => setDel(false)}
                    onConfirm={destroy}
                    itemName={`${current?.firstName || ''} ${current?.lastName || ''}`}
                >
                    Archive
                </MUIArchiveCnfModal>
            </CardContent>
        </Card>
    );
}
