
import React from 'react';
import {
    Box,
    Typography,
    Button,
    Tabs,
    Tab,
    Divider,
    CircularProgress,
    TextField,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const InterviewOutputPanel = ({
    // interviewType,
    technicalScript,
    isCodingRound,
    codingRoundData,
    showFullProblemDesc,
    setShowFullProblemDesc,
    activeTestCase,
    setActiveTestCase,
    onGenerate,
    isGenerating,
    onScriptChange,
    // onEdit,
    // onDone
}) => {
    // Determine title and content based on type
    // If Coding -> Show Problem View
    // If Other -> Show Script

    const hasContent = isCodingRound
        ? (codingRoundData?.title || codingRoundData?.description)
        : true;

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Header Actions */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    mb: 3,
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 0 },
                }}
            >
                <Typography variant="h6" sx={{ color: '#2563EB', fontWeight: 700, fontSize: '1.25rem' }}>
                    Interview Script
                </Typography>
                <Button
                    endIcon={!isGenerating ? <ExpandMoreIcon /> : null}
                    sx={{ textTransform: 'none', color: '#2563EB', fontWeight: 600 }}
                    onClick={onGenerate}
                    disabled={isGenerating}
                >
                    {isGenerating ? <CircularProgress size={16} thickness={5} /> : 'Generate'}
                </Button>
            </Box>

            {!hasContent && !isGenerating && (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                    <Typography variant="body2">
                        Select parameters and click Generate to see the plan.
                    </Typography>
                </Box>
            )}

            {hasContent && (
                <Box sx={{ flex: 1, overflowY: 'auto', pr: 1, minHeight: 0 }}>
                    {isCodingRound ? (
                        // CODING PROBLEM VIEW
                        <>
                            <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-wrap' }}>
                            {codingRoundData.description?.length > 300 && !showFullProblemDesc
                                ? `${codingRoundData.description.substring(0, 300)}...`
                                : codingRoundData.description}
                            {codingRoundData.description?.length > 300 && (
                                <Box component="span" sx={{ color: '#2563EB', cursor: 'pointer', ml: 1, fontWeight: 500 }} onClick={() => setShowFullProblemDesc(!showFullProblemDesc)}>
                                    {showFullProblemDesc ? "Show Less" : "Show More"}
                                </Box>
                            )}
                        </Typography>

                    {/* Constraints Section */}
                    {codingRoundData.constraints && codingRoundData.constraints.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#374151' }}>Constraints:</Typography>
                            <ul style={{ paddingLeft: '20px', margin: 0, color: '#4B5563' }}>
                                {codingRoundData.constraints.map((c, i) => (
                                    <li key={i}><Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{c}</Typography></li>
                                ))}
                            </ul>
                        </Box>
                    )}

                    {/* Output/Example Box matching screenshot */}


                    {/* Test Cases Tabs */}
                    {(codingRoundData.testCases && codingRoundData.testCases.length > 0) && (
                        <Box sx={{ mt: 4 }}>
                            <Tabs
                                value={activeTestCase}
                                onChange={(e, v) => setActiveTestCase(v)}
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{
                                    minHeight: 32,
                                    mb: 3,
                                    '& .MuiTabs-indicator': { display: 'none' }, // No underline
                                    '& .MuiTab-root': {
                                        minHeight: 36,
                                        textTransform: 'none',
                                        py: 0,
                                        px: 3,
                                        mr: 2,
                                        borderRadius: '6px',
                                        fontWeight: 500,
                                        color: '#6B7280'
                                    },
                                    '& .Mui-selected': {
                                        bgcolor: '#EFF6FF',
                                        color: '#2563EB !important',
                                        fontWeight: 600
                                    }
                                }}
                            >
                                {codingRoundData.testCases.map((_, idx) => (
                                    <Tab key={idx} label={`Case ${idx + 1}`} />
                                ))}
                            </Tabs>

                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: { xs: 'column', sm: 'row' },
                                    alignItems: { xs: 'stretch', sm: 'stretch' },
                                    gap: { xs: 2, sm: 3 }
                                }}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ mb: 0.5, color: '#4B5563', fontWeight: 500 }}>Input :</Typography>
                                    <Typography variant="body2" sx={{ color: '#111827', wordBreak: 'break-word' }}>
                                        {(() => {
                                            const tc = codingRoundData.testCases[activeTestCase];
                                            const val = tc?.input ?? tc?.args;
                                            return typeof val === 'object' ? JSON.stringify(val) : val;
                                        })()}
                                    </Typography>
                                </Box>

                                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
                                <Divider orientation="horizontal" flexItem sx={{ display: { xs: 'block', sm: 'none' } }} />

                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ mb: 0.5, color: '#4B5563', fontWeight: 500 }}>Output :</Typography>
                                    <Typography variant="body2" sx={{ color: '#111827', wordBreak: 'break-word' }}>
                                        {(() => {
                                            const tc = codingRoundData.testCases[activeTestCase];
                                            const val = tc?.expected ?? tc?.expectedOutput ?? tc?.output;
                                            return typeof val === 'object' ? JSON.stringify(val) : val;
                                        })()}
                                    </Typography>
                                </Box>
                            </Box>

                        </Box>
                    )}
                </>
            ) : (
            // SCRIPT VIEW
            <TextField
                multiline
                minRows={12}
                fullWidth
                value={technicalScript || ''}
                onChange={(e) => onScriptChange?.(e.target.value)}
                placeholder="Generate a script or type your own here..."
                disabled={isGenerating}
                sx={{
                    '& .MuiInputBase-root': {
                        alignItems: 'flex-start',
                    },
                }}
            />
                    )}
        </Box>
    )
}

{/* Footer Actions */ }
{/* <Box
                sx={{
                    pt: 2,
                    mt: 'auto',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 2,
                    flexDirection: { xs: 'column', sm: 'row' },
                }}
            >
                <Button
                    variant="contained"
                    sx={{
                        bgcolor: '#EBF5FF',
                        color: '#2563EB',
                        boxShadow: 'none',
                        textTransform: 'none',
                        borderRadius: '8px',
                        px: 4,
                        minWidth: '100px',
                        width: { xs: '100%', sm: 'auto' },
                        '&:hover': { bgcolor: '#DBEAFE' }
                    }}
                    onClick={onEdit}
                >
                    Edit
                </Button>
                <Button
                    variant="contained"
                    sx={{
                        textTransform: 'none',
                        boxShadow: 'none',
                        bgcolor: '#EBF5FF',
                        color: '#2563EB',
                        borderRadius: '8px',
                        px: 4,
                        minWidth: '100px',
                        width: { xs: '100%', sm: 'auto' },
                        '&:hover': { bgcolor: '#DBEAFE' }
                    }}
                    onClick={onDone}
                >
                    Done
                </Button>
            </Box> */}
        </Box >
    );
};

export default InterviewOutputPanel;
