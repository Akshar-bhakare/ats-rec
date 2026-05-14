import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useCompanyContextState } from '../../contexts/CompanyContext';
import { useJobContextState } from '../../contexts/JobContext';
import { useUiContextState } from '../../contexts/UiContext';
import {
    Box,
    Typography,
    Divider,
    IconButton,
    Skeleton,
} from '@mui/material';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import MUIButton from '../MUI/commonUI/MUIButton';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { Archive, Edit, RefreshRounded } from '@mui/icons-material';
import { setDocumentTitle } from '../../AppUtils/documentTitle';



export default function CompanyDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [authState] = useAuthContextState();
    const [, setCompanyState] = useCompanyContextState();
    const [, setJobState] = useJobContextState();
    const [, setUiState] = useUiContextState();

    const [company, setCompany] = useState(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const loadCompany = () => {
        setCompany(null);
        // setUiState({
        //     loadingMsg: "Loading, Please wait..."
        // });

        fetchData(`/api/companies/${id}`)
            .then(async (c) => {
                setCompany(c);
            })
            .catch(console.error)
            .finally(() => {
                setUiState({
                    loadingMsg: null,
                });
            });
    };

    useEffect(() => {
        loadCompany();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        setDocumentTitle(company?.name || 'Company Detail');
    }, [company?.name]);


    if (!company) {
        return (
            <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: 4, p: { xs: 2, sm: 4 }, bgcolor: "background.paper" }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton variant="text" width={240} height={32} />
                    <Box sx={{ flex: 1 }} />
                    <Skeleton variant="rounded" width={180} height={36} />
                    <Skeleton variant="rounded" width={80} height={36} />
                    <Skeleton variant="rounded" width={90} height={36} />
                </Box>

                <Skeleton variant="rounded" height={180} sx={{ mb: 3 }} />

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, gap: 3 }}>
                    <Skeleton variant="rounded" height={260} />
                    <Skeleton variant="rounded" height={260} />
                </Box>
            </Box>
        );
    }

    const handleEdit = () => {
        setCompanyState({ companyInitialValuesDict: { ...company, id: company._id } });
        navigate('/companies/new/');
    };

    const handleArchive = () => {

        setUiState({
            loadingMsg: "Loading, Please wait..."
        });

        fetchData(`/api/companies/${id}`, { method: 'DELETE' })
            .then(() => {
                // ✅ pass success toast to CompaniesList (same behavior as list snackbar)
                navigate('/companies', {
                    state: {
                        toast: {
                            open: true,
                            message: 'Company archived.',
                            severity: 'success',
                        }
                    }
                });
            })
            .catch(console.error)
            .finally(() => {

                setUiState({
                    loadingMsg: null,
                });

            });
    }


    const display = (v) => (v ? v : '—');
    const canEditCompany =
        authState.user?.role === 'recruiter'
            ? authState.user?.accessRestrictions?.company !== false
            : true;
    const paragraphSx = {
        color: 'text.secondary',
        textAlign: 'justify',
        textJustify: 'inter-word',
        hyphens: 'auto',
    };
    const InfoRow = ({ label, children, stacked = false }) => (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: stacked ? 'column' : 'row' },
                alignItems: { xs: 'flex-start', sm: stacked ? 'flex-start' : 'baseline' },
                gap: { xs: 0.5, sm: stacked ? 0.75 : 2 },
            }}
        >
            <Typography
                variant="caption"
                sx={{
                    color: 'text.secondary',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    minWidth: stacked ? 'auto' : { sm: 180 },
                    flexShrink: stacked ? 1 : 0,
                }}
            >
                {label}
            </Typography>
            <Box sx={{ color: 'text.primary', flex: 1, minWidth: 0 }}>{children}</Box>
        </Box>
    );

    return (
        <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: 4, p: { xs: 2, sm: 4 }, bgcolor: "background.paper" }}>
            <Box sx={{ width: '100%', bgcolor: "background.paper" }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 3,
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: 2,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <IconButton onClick={() => navigate(-1)}><ArrowBackIosIcon /></IconButton>
                        <Typography variant="h5">{company.name}</Typography>
                        <IconButton size="small" onClick={loadCompany}>
                            <RefreshRounded fontSize="small" />
                        </IconButton>
                    </Box>
                    {canEditCompany && (
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <MUIButton onClick={() => {
                                setJobState((prev = {}) => ({
                                    ...prev,
                                    jobInitialValuesDict: {
                                        company: company._id
                                    },
                                }));
                                navigate('/jobs/new/');

                            }}
                                startIcon={<AddBusinessRoundedIcon />}
                            >

                                Job for {company.name}
                            </MUIButton>

                            <MUIButton startIcon={<Edit />} onClick={handleEdit}>
                                Edit
                            </MUIButton>
                            <MUIButton startIcon={<Archive />} onClick={() => setDeleteOpen(true)}>
                                Archive
                            </MUIButton>
                        </Box>
                    )}
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Box sx={{ display: 'grid', gap: 3 }}>
                    <Box
                        sx={{
                            p: { xs: 2.5, md: 3 },
                            borderRadius: 3,
                            border: '1px solid #e3e8ff',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Overview
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <InfoRow label="Industry">
                                    <Typography sx={{ fontWeight: 600 }}>{display(company.industry)}</Typography>
                                </InfoRow>
                                <InfoRow label="Website">
                                    {company.website ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box
                                                sx={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    bgcolor: 'primary.main',
                                                    color: 'primary.contrastText',
                                                }}
                                            >
                                                <LinkRoundedIcon fontSize="small" />
                                            </Box>
                                            <Typography
                                                component="a"
                                                href={company.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{ textDecoration: 'none', color: 'primary.main', fontWeight: 600 }}
                                            >
                                                {company.website}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Typography>{display(company.website)}</Typography>
                                    )}
                                </InfoRow>
                            </Box>
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <InfoRow label="Size">
                                    <Typography sx={{ fontWeight: 600 }}>{display(company.size)}</Typography>
                                </InfoRow>
                                <InfoRow label="Description">
                                    <Typography sx={paragraphSx}>
                                        {display(company.description)}
                                    </Typography>
                                </InfoRow>
                            </Box>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            p: { xs: 2.5, md: 3 },
                            borderRadius: 3,
                            border: '1px solid #e3e8ff',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Company Details
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ display: 'grid', gap: 2 }}>
                            <InfoRow label="About" stacked>
                                <Typography sx={paragraphSx}>{display(company.about)}</Typography>
                            </InfoRow>
                            <InfoRow label="Policy & Benefits" stacked>
                                <Typography sx={paragraphSx}>{display(company.policyBenefits)}</Typography>
                            </InfoRow>
                            <InfoRow label="FAQs" stacked>
                                <Typography sx={paragraphSx}>{display(company.faqs)}</Typography>
                            </InfoRow>
                        </Box>
                    </Box>

                </Box>

                <MUIArchiveCnfModal
                    open={deleteOpen}
                    onClose={() => setDeleteOpen(false)}
                    onConfirm={handleArchive}
                    itemName={company.name}
                >
                    Archive
                </MUIArchiveCnfModal>
            </Box>
        </Box >
    );
}
