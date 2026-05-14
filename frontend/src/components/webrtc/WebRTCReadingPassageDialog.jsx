import React from "react";
import {
    Dialog,
    DialogContent,
    CardContent,
    Typography,
    Button,
    Box,
    CircularProgress
} from "@mui/material";

export default function WebRTCReadingPassageDialog({
    open,
    passage,
    difficultyLevel,
    loading,
    error,
    isRecording,
    isSubmitting,
    onStartRecording,
    onSubmit,
    onRetry,
    onCancel,
    isXs
}) {
    const difficultyLabel = difficultyLevel || "Intermediate";
    const canStart = !loading && !isRecording && !!passage && !isSubmitting;
    const canSubmit = !loading && isRecording && !isSubmitting;

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            PaperProps={{
                sx: {
                    borderRadius: "16px",
                    padding: "4px",
                    minWidth: isXs ? "92vw" : "520px",
                    maxWidth: "92vw"
                }
            }}
        >
            <DialogContent sx={{ padding: "22px 20px" }}>
                <CardContent sx={{ padding: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        Reading Passage
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
                        Read the passage aloud. This helps assess communication and English fluency.
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 1,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 999,
                            bgcolor: "action.hover",
                            color: "text.secondary",
                            mb: 2
                        }}
                    >
                        Difficulty: {difficultyLabel}
                    </Typography>

                    {loading ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2 }}>
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">
                                Generating passage...
                            </Typography>
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                borderRadius: 2,
                                border: 1,
                                borderColor: "divider",
                                bgcolor: "background.default",
                                p: 2,
                                maxHeight: 220,
                                overflow: "auto",
                                fontSize: 14,
                                lineHeight: 1.7,
                                color: "text.primary",
                                mb: 2
                            }}
                        >
                            {passage || "No passage available."}
                        </Box>
                    )}

                    {error && (
                        <Typography variant="body2" sx={{ color: "error.main", mb: 1.5 }}>
                            {error}
                        </Typography>
                    )}
                    {isRecording && (
                        <Typography variant="caption" sx={{ color: "success.main", mb: 1.5, display: "block" }}>
                            Recording...
                        </Typography>
                    )}

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                        {!isRecording ? (
                            <Button
                                variant="contained"
                                sx={{ padding: "10px 22px", fontWeight: 600, borderRadius: "10px", textTransform: "none" }}
                                onClick={onStartRecording}
                                disabled={!canStart}
                            >
                                Start Reading
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                color="success"
                                sx={{ padding: "10px 22px", fontWeight: 600, borderRadius: "10px", textTransform: "none" }}
                                onClick={onSubmit}
                                disabled={!canSubmit}
                            >
                                {isSubmitting ? "Submitting..." : "Stop & Submit"}
                            </Button>
                        )}

                        {error && !loading && (
                            <Button
                                variant="outlined"
                                sx={{ padding: "8px 20px", fontWeight: 500, borderRadius: "10px", textTransform: "none" }}
                                onClick={onRetry}
                            >
                                Retry
                            </Button>
                        )}

                        <Button
                            variant="outlined"
                            sx={{ padding: "8px 20px", fontWeight: 500, borderRadius: "10px", textTransform: "none", borderColor: "divider", color: "text.secondary" }}
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                    </Box>
                </CardContent>
            </DialogContent>
        </Dialog>
    );
}
