import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import ServiceCard from '../../userSettings/ServiceCard';
// import ServiceCard from '../../userSettings/ServiceCard';


export default function MUIRetrieveCardGrid({ rows = [], title = 'Services', onEdit, onDelete }) {
    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {title}
            </Typography>
            <Grid container spacing={2}>
                {rows.map((cfg) => (
                    <Grid item xs={12} sm={6} md={4} key={cfg.id ?? cfg.configName}>
                        <ServiceCard
                            cfg={cfg}
                            onEdit={() => onEdit?.(cfg)}
                            onDelete={() => onDelete?.(cfg)}
                        />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
