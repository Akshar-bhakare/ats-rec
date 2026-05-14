import { useState } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Container,
    Stack,
    Typography,
    alpha,
    useTheme
} from '@mui/material';
import { ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from '../lib/constants';

const FaqSection = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [expanded, setExpanded] = useState(false);

    return (
        <Box
            id="faq"
            component="section"
            sx={{
                py: { xs: 7, md: 9 },
                position: 'relative',
                overflow: 'hidden',
                bgcolor: isDark ? '#05070b' : '#f7f8fb'
            }}
        >
            <Container sx={{ position: 'relative', zIndex: 1, maxWidth: '1040px !important' }}>
                <Stack spacing={{ xs: 3, md: 4 }} alignItems="center">
                    <Typography
                        sx={{
                            textAlign: 'center',
                            fontFamily: "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
                            fontSize: { xs: '2rem', md: '3rem' },
                            lineHeight: { xs: 1.1, md: 1.04 },
                            letterSpacing: '-0.05em',
                            fontWeight: 900,
                            color: 'text.primary'
                        }}
                    >
                        Frequently Asked Questions
                    </Typography>

                    <Box sx={{ width: '100%' }}>
                        {FAQ_ITEMS.map((item, index) => {
                            const panelId = `faq-panel-${index}`;
                            const isExpanded = expanded === panelId;

                            return (
                                <Accordion
                                    key={item.question}
                                    disableGutters
                                    expanded={isExpanded}
                                    onChange={(_, nextExpanded) => setExpanded(nextExpanded ? panelId : false)}
                                    sx={{
                                        mb: 1.8,
                                        borderRadius: '18px !important',
                                        overflow: 'hidden',
                                        bgcolor: isDark ? alpha('#0f172a', 0.82) : '#ffffff',
                                        border: `1px solid ${alpha(isDark ? '#f8fafc' : '#d8e1ec', isDark ? 0.08 : 0.92)}`,
                                        boxShadow: isDark
                                            ? '0 18px 48px -34px rgba(2, 6, 23, 0.88)'
                                            : '0 18px 40px -34px rgba(15, 23, 42, 0.18)',
                                        '&:before': {
                                            display: 'none'
                                        }
                                    }}
                                >
                                    <AccordionSummary
                                        expandIcon={<ChevronDown size={18} color={theme.palette.primary.main} />}
                                        aria-controls={`${panelId}-content`}
                                        id={`${panelId}-header`}
                                        sx={{
                                            px: { xs: 2.2, md: 2.8 },
                                            py: { xs: 0.45, md: 0.6 },
                                            minHeight: { xs: 68, md: 72 },
                                            '& .MuiAccordionSummary-content': {
                                                my: 0
                                            },
                                            '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
                                                transform: 'rotate(180deg)'
                                            }
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontFamily: "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
                                                fontSize: { xs: '1rem', md: '1.1rem' },
                                                lineHeight: 1.35,
                                                fontWeight: 800,
                                                color: 'text.primary'
                                            }}
                                        >
                                            {item.question}
                                        </Typography>
                                    </AccordionSummary>

                                    <AccordionDetails
                                        sx={{
                                            px: { xs: 2.2, md: 2.8 },
                                            pb: { xs: 2.2, md: 2.5 },
                                            pt: 0
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                maxWidth: 820,
                                                fontSize: { xs: '0.92rem', md: '0.98rem' },
                                                lineHeight: 1.75,
                                                color: 'text.secondary'
                                            }}
                                        >
                                            {item.answer}
                                        </Typography>
                                    </AccordionDetails>
                                </Accordion>
                            );
                        })}
                    </Box>
                </Stack>
            </Container>
        </Box>
    );
};

export default FaqSection;
