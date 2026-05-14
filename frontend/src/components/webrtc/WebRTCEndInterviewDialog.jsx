import React from "react";
import { Dialog, DialogContent, CardContent, Typography, Button } from "@mui/material";

export default function WebRTCEndInterviewDialog({
    open,
    onCancel,
    onConfirm,
    isAIInterviewer,
    isXs
}) {
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            PaperProps={{
                sx: {
                    borderRadius: "16px",
                    padding: "4px",
                    minWidth: isXs ? "92vw" : "380px",
                    maxWidth: "92vw"
                }
            }}
        >
            <DialogContent sx={{ padding: "24px 20px" }}>
                <CardContent sx={{ textAlign: "center" }}>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: "bold",
                            marginBottom: "8px"
                        }}
                    >
                        End Interview?
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{
                            marginBottom: "24px",
                            color: "text.secondary",
                            lineHeight: 1.5
                        }}
                    >
                        Once you end this interview, the call will stop
                        {isAIInterviewer
                            ? " and the AI will generate an evaluation summary."
                            : ". You will be returned to the home page."}{" "}
                        Do you want to proceed?
                    </Typography>

                    <div className="webrtc-confirm-actions">
                        <Button
                            variant="contained"
                            color="error"
                            sx={(theme) => ({
                                padding: "10px 26px",
                                fontWeight: 600,
                                borderRadius: "10px",
                                textTransform: "none",
                                boxShadow: theme.shadows[3],
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    boxShadow: theme.shadows[4]
                                }
                            })}
                            onClick={onConfirm}
                        >
                            End Interview
                        </Button>

                        <Button
                            variant="outlined"
                            sx={{
                                padding: "8px 22px",
                                fontWeight: 500,
                                borderRadius: "10px",
                                textTransform: "none",
                                borderColor: "divider",
                                color: "text.secondary",
                                "&:hover": {
                                    borderColor: "text.primary",
                                    backgroundColor: "action.hover"
                                }
                            }}
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                    </div>
                </CardContent>
            </DialogContent>
        </Dialog>
    );
}
