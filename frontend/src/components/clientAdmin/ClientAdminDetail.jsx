import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import {
    Box,
    Typography,
    Button,
    Divider,
    Card,
    CardContent,
} from '@mui/material';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import MUIButton from '../MUI/commonUI/MUIButton';
import ServicesList from '../userSettings/ServicesList';
import { useClientAdminContextState } from '../../contexts/ClientAdminContext';
import { useUiContextState } from '../../contexts/UiContext';
import { setDocumentTitle } from '../../AppUtils/documentTitle';

export default function ClientAdminDetail() {
    const { id: routeId } = useParams();
    const nav = useNavigate();
    const [, setClientAdminState] = useClientAdminContextState();
    const [, setUiState] = useUiContextState();
    const [admin, setAdmin] = useState(null);
    const [delOpen, setDelOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const pickMatch = (list, key) =>
        list.find(
            doc =>
                (doc._id && String(doc._id) === String(key)) ||
                (doc.user && doc.user._id && String(doc.user._id) === String(key)) ||
                String(doc.client) === String(key)
        );

    useEffect(() => {
        let mounted = true;
        const done = (rec = null) => {
            if (mounted) {
                setAdmin(rec);
                setLoading(false);
            }
        };

        setUiState({
            loadingMsg: "Loading, Please wait..."
        });

        fetchData(`/api/admins/${routeId}`)
            .then(done)
            .catch(err => {
                if (err?.message?.includes('404')) {
                    fetchData('/api/admins')
                        .then(list => {
                            const found = Array.isArray(list) ? pickMatch(list, routeId) : null;
                            done(found);
                        })
                        .catch(e => {
                            console.error('ClientAdminDetail second-fetch error:', e);
                            done(null);
                        });
                } else {
                    console.error('ClientAdminDetail fetch error:', err);
                    done(null);
                }
            })
            .finally(() => {
                setUiState({
                    loadingMsg: null,
                });
            });

        return () => {
            mounted = false;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeId]);

    const adminName = [
        admin?.user?.firstName,
        admin?.user?.lastName,
    ].filter(Boolean).join(' ').trim() || admin?.clientCompany || '';

    useEffect(() => {
        setDocumentTitle(adminName || 'Client Admin Detail');
    }, [adminName]);

    const attemptDelete = async () => {
        const targets = [
            admin?.client && `/api/admins/${admin.client}`,
            admin?._id && `/api/admins/${admin._id}`,
        ].filter(Boolean);

        for (const url of targets) {
            try {
                setUiState({
                    loadingMsg: "Loading, Please wait..."
                });

                await fetchData(url, { method: 'DELETE' });
                return true;
            } finally {
                setUiState({
                    loadingMsg: null,
                });
            }
        }
        return false;
    };

    const handleEdit = () => {
        const user = admin?.user || {};
        const initialValues = {
            id: admin?._id || admin?.client || user?._id || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phoneNumber: user.phoneNumber || user.phone || '',
            clientCompany: admin.clientCompany || '',
            totalCredit: admin.totalCredit ?? 0,
            videoInterviewCredit: admin.videoInterviewCredit ?? 0,
            creditRatePerCall: admin.creditRatePerCall ?? 0,
        };

        setClientAdminState({ clientAdminInitialValuesDict: initialValues });

        nav('/admins/new');
    };

    const handleArchive = () =>
        attemptDelete()
            .then(ok => ok && nav('/admins'))
            .catch(console.error);

    if (loading) {
        return (
            <MUICenterLayout>
                <Typography>Loading…</Typography>
            </MUICenterLayout>
        );
    }
    if (!admin) {
        return (
            <MUICenterLayout>
                <Typography color="error">Client-Admin not found.</Typography>
            </MUICenterLayout>
        );
    }

    const u = admin.user || {};

    return (
        <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: 4 }}>
            <Card sx={{ width: '100%', minHeight: 'calc(100vh - 200px)' }}>
                <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
                    <Button startIcon={<ArrowBackIosIcon />} onClick={() => nav(-1)} sx={{ mb: 2 }}>
                        Back
                    </Button>

                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            justifyContent: 'space-between',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            mb: 3,
                            gap: 2,
                        }}
                    >
                        <Typography variant="h5">
                            {u.firstName} {u.lastName}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <MUIButton onClick={handleEdit}>
                                Edit
                            </MUIButton>
                            <MUIButton onClick={() => setDelOpen(true)}>
                                Archive
                            </MUIButton>
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    <Typography variant="h6" align="center" gutterBottom>
                        Client-Admin Details
                    </Typography>

                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            mt: 2,
                        }}
                    >
                        {[
                            ['First Name', u.firstName],
                            ['Last Name', u.lastName],
                            ['Email', u.email],
                            ['Client Company', admin.clientCompany],
                            ['Hirex REC WhatsApp Number', admin.aiSelektWaId],
                            ['AI Call Credit', admin.totalCredit],
                            ['Video Interview Credit', admin.videoInterviewCredit],
                            ['Credit Rate / Call', admin.creditRatePerCall],
                        ].map(([label, value]) => (
                            <Box
                                key={label}
                                sx={{
                                    flex: '1 1 30%',
                                    minWidth: { xs: '100%', sm: '45%', md: '30%' },
                                }}
                            >
                                <Typography color="text.secondary">{label}</Typography>
                                <Typography>{value ?? '—'}</Typography>
                            </Box>
                        ))}
                    </Box>

                    <Divider sx={{ my: 4 }} />
                    <ServicesList
                        mode="client"
                        clientId={admin.user?._id}
                    />

                    <MUIArchiveCnfModal
                        open={delOpen}
                        onClose={() => setDelOpen(false)}
                        onConfirm={handleArchive}
                        itemName={`${u.firstName} ${u.lastName}`}
                    >
                        Archive
                    </MUIArchiveCnfModal>
                </CardContent>
            </Card>
        </Box>
    );
}
