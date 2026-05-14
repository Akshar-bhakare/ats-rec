import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Typography,
    Chip,
    Divider,
    Stack,
    useTheme,
    Avatar,
    Link,
    useMediaQuery,
    Button,
} from '@mui/material';
import defaultAvatar from '../../assets/default_avatar.jpg';

const CandidateCard = ({ candidate }) => {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    const [showAllHardSkills, setShowAllHardSkills] = useState(false);
    const [showHardSkillsToggle, setShowHardSkillsToggle] = useState(false);
    const hardSkillsRef = useRef(null);

    const rowHeight = 24;
    const rowGap = 8;
    const maxRows = 5;
    const maxHeight = `calc(${rowHeight}px * ${maxRows} + ${rowGap}px * ${maxRows - 1})`;

    useEffect(() => {
        if (!hardSkillsRef.current) return;
        const el = hardSkillsRef.current;
        const hasOverflow = el.scrollHeight - el.clientHeight > 1;
        setShowHardSkillsToggle(hasOverflow || showAllHardSkills);
    }, [candidate?.hardSkills, showAllHardSkills, isDesktop]);

    const COLORS = {
        white: '#FFFFFF',
        primaryBlue: '#2563EB',
        textLabel: '#374151',
        textValue: '#111827',
        divider: '#E5E7EB',
        chipBg: '#F3F4F6',
        chipText: '#374151',
        shadow: '0 4px 12px rgba(0,0,0,0.08)',
    };

    const labelWidth = 110;

    const DetailRow = ({ label, value, isLink = false }) => (
        <Box display="flex" alignItems="baseline" mb="4px" minWidth={0}>
            <Typography
                sx={{
                    color: COLORS.textLabel,
                    fontWeight: 700,
                    fontSize: '14px',
                    minWidth: labelWidth,
                    mr: 1,
                    flexShrink: 0,
                }}
                component="span"
            >
                {label}:
            </Typography>
            {isLink ? (
                <Link
                    href={`mailto:${value}`}
                    underline="hover"
                    sx={{
                        color: COLORS.primaryBlue,
                        fontSize: '14px',
                        fontWeight: 400,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                    }}
                >
                    {value}
                </Link>
            ) : (
                <Typography
                    sx={{
                        color: COLORS.textValue,
                        fontWeight: 400,
                        fontSize: '14px',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                    component="span"
                >
                    {value}
                </Typography>
            )}
        </Box>
    );

    const SectionHeader = ({ title }) => (
        <Typography
            sx={{
                color: COLORS.primaryBlue,
                fontWeight: 600,
                fontSize: '20px',
                mb: 1.25,
                lineHeight: 1.2,
            }}
        >
            {title}
        </Typography>
    );

    const SkillsGroup = ({ title, skills, collapsible }) => {
        if (!skills || skills.length === 0) return null;
        return (
            <Box mb={1.5}>
                <SectionHeader title={title} />
                <Box
                    ref={collapsible ? hardSkillsRef : undefined}
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        columnGap: '8px',
                        rowGap: '8px',
                        overflow: collapsible && !showAllHardSkills ? 'hidden' : 'visible',
                        maxHeight: collapsible && !showAllHardSkills ? maxHeight : 'none',
                    }}
                >
                    {skills.map((skill, idx) => (
                        <Chip
                            key={`${title}-${idx}`}
                            label={skill}
                            size="small"
                            sx={{
                                backgroundColor: COLORS.chipBg,
                                color: COLORS.chipText,
                                borderRadius: '6px',
                                fontWeight: 500,
                                fontSize: '12px',
                                height: `${rowHeight}px`,
                                '& .MuiChip-label': {
                                    px: 1,
                                },
                            }}
                        />
                    ))}
                </Box>
                {collapsible && showHardSkillsToggle && (
                    <Button
                        onClick={() => setShowAllHardSkills((prev) => !prev)}
                        size="small"
                        sx={{
                            mt: 1,
                            px: 0,
                            minWidth: 'auto',
                            textTransform: 'none',
                            color: COLORS.primaryBlue,
                            fontWeight: 600,
                        }}
                    >
                        {showAllHardSkills ? 'Read less' : 'Read more'}
                    </Button>
                )}
            </Box>
        );
    };

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                px: { xs: 2, md: 2.5 },
                py: 0.75,
            }}
        >
            <Box
                display="flex"
                flexDirection={{ xs: 'column', md: 'row' }}
                flexWrap="nowrap"
                gap={isDesktop ? 1.5 : 2}
                position="relative"
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'flex-start', md: 'center' },
                        gap: { xs: 1.5, md: 2.5 },
                        flexGrow: 0,
                        width: '100%',
                        minWidth: { xs: '100%', md: '360px' },
                        maxWidth: { md: '420px' },
                    }}
                >
                    <Box sx={{ flexShrink: 0 }}>
                        <Avatar
                            variant="rounded"
                            src={candidate.avatarUrl || defaultAvatar}
                            sx={{
                                width: { xs: 92, sm: 120, md: 140 },
                                height: { xs: 92, sm: 120, md: 140 },
                                borderRadius: '16px',
                                border: 'none',
                                objectFit: 'cover',
                                boxShadow: COLORS.shadow,
                            }}
                            imgProps={{
                                style: { objectFit: 'cover', objectPosition: 'top' },
                            }}
                        />
                    </Box>

                    <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                        <SectionHeader title="Candidate Details" />
                        <Stack spacing={0.5}>
                            <DetailRow label="Name" value={candidate.name} />
                            <DetailRow label="Email" value={candidate.email} isLink />
                            <DetailRow label="Phone" value={candidate.phone} />
                            <DetailRow label="Created At" value={candidate.createdAt} />
                            <DetailRow label="Experience" value={candidate.experience} />
                            <DetailRow label="Status" value={candidate.status} />
                        </Stack>
                    </Box>
                </Box>

                {isDesktop && (
                    <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: COLORS.divider }} />
                )}

                <Box
                    sx={{
                        flexGrow: 1,
                        minWidth: isDesktop ? '200px' : '100%',
                        width: '100%',
                        borderTop: !isDesktop ? `1px solid ${COLORS.divider}` : 'none',
                        pt: !isDesktop ? 3 : 0,
                    }}
                >
                    <SkillsGroup title="Skills" skills={candidate.hardSkills} collapsible />
                    <SkillsGroup title="Soft Skills" skills={candidate.softSkills} />
                </Box>

                {isDesktop && (
                    <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: COLORS.divider }} />
                )}

                <Box
                    sx={{
                        width: isDesktop ? '240px' : '100%',
                        flexShrink: 0,
                        borderTop: !isDesktop ? `1px solid ${COLORS.divider}` : 'none',
                        pt: !isDesktop ? 3 : 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: { md: 'center' },
                    }}
                >
                    <SectionHeader title="Job Details" />
                    <Stack spacing={0}>
                        <DetailRow label="Title" value={candidate.jobTitle} />
                        <DetailRow label="Company" value={candidate.company} />
                        <DetailRow label="Posted On" value={candidate.postedOn} />
                        <DetailRow label="Job Type" value={candidate.jobType} />
                        <DetailRow label="Location" value={candidate.location} />
                        <DetailRow label="Status" value={candidate.status} />
                    </Stack>
                </Box>
            </Box>
        </Box>
    );
};

export default CandidateCard;
