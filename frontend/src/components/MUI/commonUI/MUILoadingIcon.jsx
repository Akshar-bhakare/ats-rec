import React from 'react';
import { CircularProgress } from '@mui/material';

const MUILoadingIcon = ({ size = 15, thickness = 6, sx: customSx = {}, ...props }) => {
    return (<>
        <svg width={0} height={0}>
            <defs>
                <linearGradient id="id_loading_icon_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#e01cd5" />
                    <stop offset="100%" stopColor="#1CB5E0" />
                </linearGradient>
            </defs>
        </svg>
        <CircularProgress size={size} thickness={thickness}
            sx={{
                'svg circle': {
                    stroke: 'url(#id_loading_icon_gradient)',
                },
                ...customSx
            }}
            {...props}
        />
    </>);
}

export default MUILoadingIcon;