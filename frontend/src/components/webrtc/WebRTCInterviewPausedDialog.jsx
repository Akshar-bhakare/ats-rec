import React from "react";
import { Dialog, DialogContent, Card, CardContent, Typography, Button } from "@mui/material";
import MUIButton from "../MUI/commonUI/MUIButton";

export default function WebRTCInterviewPausedDialog({
    open,
    onResume,
    isXs
}) {
    return (
        <Dialog
            open={open}
            onClose={() => { }}
            disableEscapeKeyDown
            PaperProps={{
                sx: {
                    borderRadius: "16px",
                    padding: "6px",
                    minWidth: isXs ? "92vw" : "360px",
                    maxWidth: "92vw"
                }
            }}
        >
            <DialogContent sx={{ padding: "24px 22px" }}>
                <Card sx={{ boxShadow: "none" }}>
                    <CardContent
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            textAlign: "center"
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Interview Paused
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            This interview is paused. Click Unpause to continue.
                        </Typography>
                        <MUIButton
                            variant="contained"
                            sx={(theme) => ({
                                padding: "10px 26px",
                                fontWeight: 600,
                                borderRadius: "10px",
                                textTransform: "none",
                                boxShadow: theme.shadows[2],
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    boxShadow: theme.shadows[3]
                                }
                            })}
                            onClick={onResume}
                        >
                            resume
                        </MUIButton>
                    </CardContent>
                </Card>
            </DialogContent>
        </Dialog>
    );
}
