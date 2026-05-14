import React from "react";
import { Button } from "@mui/material";
// import { useTheme } from "@mui/material/styles";

const MUIButton = ({ sx = {}, boxColOptions, ...props }) => {

    return (
        <Button
            size={props?.size || "small"}
            variant={props?.variant || "outlined"}
            sx={{
                textTransform: 'none',
                textWrap: "stable",
                p: 0.5,
                ...sx,
            }}
            color={sx?.color || props?.color}
            {...props}
        >
            {props?.value || ''}{props?.label || ''}{props?.text || ''}
            {props?.children}
        </Button>
    );
};

export default MUIButton;
