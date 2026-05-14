import React from 'react';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/**
 * A single‐panel accordion wrapper.
 *
 * Props:
 * - title: string            // text shown in the header
 * - defaultExpanded?: bool   // whether it starts open
 * - children: ReactNode      // typically your <TextField/>
 */
export default function MUIAccordion({
    title,
    defaultExpanded = false,
    children,
}) {
    return (
        <Accordion defaultExpanded={defaultExpanded}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel-content"
                id="panel-header"
            >
                <Typography>{title}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                {children}
            </AccordionDetails>
        </Accordion>
    );
}
