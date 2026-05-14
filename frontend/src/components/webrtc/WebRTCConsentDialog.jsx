import React from "react";
import {
    Card,
    CardContent,
    Checkbox,
    Dialog,
    DialogContent,
    Divider,
    FormControlLabel,
    Typography
} from "@mui/material";
import MUIButton from "../MUI/commonUI/MUIButton";

export default function WebRTCConsentDialog({
    open,
    consentChecked,
    onConsentChange,
    consentSubmitting,
    onStartInterview,
    interviewerType,
    userRole,
    isXs
}) {
    const normalizedRole = userRole === "interviewer" ? "interviewer" : "candidate";
    const isHumanLedInterview =
        interviewerType === "Human" || interviewerType === "Human+AI";
    const isHybridInterview = interviewerType === "Human+AI";

    const dialogTitle = isHumanLedInterview
        ? normalizedRole === "interviewer"
            ? "Interviewer Consent"
            : "Candidate Consent"
        : "Interview Consent";

    const helperText = isHumanLedInterview
        ? normalizedRole === "interviewer"
            ? "When you continue, the live interview room opens immediately. There is no separate Start Answering button in human-led interviews."
            : "When you continue, the live room starts immediately and transcript capture begins automatically. There is no separate Start Answering button in human-led interviews."
        : 'Click "Start Answering" when you need to respond, click "Stop" when you are finished, and wait for the response before replying again.';

    const secondaryText = isHumanLedInterview
        ? isHybridInterview
            ? "This room is human led with AI support for transcript and evaluation. Review the session rules before entering."
            : "This room is human led. Review the session rules before entering."
        : "Please review these terms before starting the interview.";

    const consentItems = isHumanLedInterview
        ? normalizedRole === "interviewer"
            ? [
                "I confirm I am authorized to conduct and record this interview session.",
                "I will clearly guide the candidate before asking questions or requesting documents.",
                "I will only use the in-room chat and document sharing for interview-related communication.",
                "I understand recording and transcript capture begin automatically when I enter the room."
            ]
            : [
                "I consent to audio, video, and transcript capture for interview evaluation.",
                "I understand the live interview room starts immediately after I continue.",
                "I will keep my camera and microphone ready and follow the interviewer's instructions.",
                "I will only use the in-room chat and document sharing for interview-related communication."
            ]
        : [
            "I consent to audio and video recording for interview evaluation.",
            "I understand this session may be monitored for quality and compliance.",
            "I agree to follow interviewer instructions and maintain a quiet environment.",
            "I will not switch tabs or use external assistance during the interview.",
        ];

    const checkboxLabel = isHumanLedInterview
        ? "I have read the room rules and agree to continue."
        : "I have read and agree to the terms above.";

    const actionLabel = isHumanLedInterview
        ? normalizedRole === "interviewer"
            ? "Enter Interview Room"
            : "Join Interview Room"
        : "Start Interview";

    return (
        <Dialog
            open={open}
            onClose={() => { }}
            disableEscapeKeyDown
            PaperProps={{
                sx: {
                    borderRadius: "16px",
                    padding: "6px",
                    minWidth: isXs ? "92vw" : "440px",
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
                            gap: 2
                        }}
                    >
                        <Typography
                            variant="h6"
                            sx={{ fontWeight: 700 }}
                        >
                            {dialogTitle}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: isHumanLedInterview ? "warning.main" : "error.main",
                                fontWeight: 600
                            }}
                        >
                            {helperText}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                        >
                            {secondaryText}
                        </Typography>
                        <Divider />
                        <ul className="webrtc-consent-list">
                            {consentItems.map((item) => (
                                <li key={item}>
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <FormControlLabel
                            control={(
                                <Checkbox
                                    checked={consentChecked}
                                    onChange={(event) =>
                                        onConsentChange(event.target.checked)
                                    }
                                />
                            )}
                            label={checkboxLabel}
                        />
                        <MUIButton
                            variant="contained"
                            disabled={!consentChecked || consentSubmitting}
                            onClick={onStartInterview}
                            sx={{
                                textTransform: "none",
                                fontWeight: 600,
                                borderRadius: "10px",
                                padding: "10px 18px"
                            }}
                        >
                            {actionLabel}
                        </MUIButton>
                    </CardContent>
                </Card>
            </DialogContent>
        </Dialog>
    );
}
