import React from "react";
import {
    Dialog,
    DialogContent,
    Typography,
    Box,
    Button
} from "@mui/material";

export default function WebRTCFaceMismatchDialog({
    open,
    matchScore,
    thresholdPercent = 70,
    onClose
}) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderRadius: "14px",
                    minWidth: { xs: "92vw", sm: 420 },
                    maxWidth: "92vw"
                }
            }}
        >
            <DialogContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    Face Mismatch Detected
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
                    We found that your face does not match the uploaded verification photo/video.
                    Please stay clearly visible and ensure only you are in frame.
                </Typography>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 1,
                        mb: 2
                    }}
                >
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Live match score
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {Number.isFinite(matchScore) ? `${matchScore.toFixed(2)}%` : "N/A"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Required threshold
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {thresholdPercent}%
                    </Typography>
                </Box>
                <Button variant="contained" onClick={onClose}>
                    Continue Interview
                </Button>
            </DialogContent>
        </Dialog>
    );
}
