import React from "react";
import {
    Card,
    CardHeader,
    CardContent,
    CardActions,
    Typography,
    IconButton,
    Divider,
    Stack,
    Chip,
    Box,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

export default function ServiceCard({ cfg, onEdit, onDelete }) {
    // Safely extract configurationDetails
    const config = cfg.configurationDetails || {};

    // serviceType is array, show first or fallback
    const serviceTypeDisplay = Array.isArray(cfg.serviceType)
        ? cfg.serviceType[0]
        : cfg.serviceType;
    const isEmailService = String(serviceTypeDisplay || "").toLowerCase() === "email";

    const hasValue = (val) => (
        val !== undefined &&
        val !== null &&
        !(typeof val === "string" && val.trim() === "")
    );

    const readCfg = (...keys) => {
        for (const key of keys) {
            if (hasValue(config[key])) return config[key];
        }
        return "";
    };

    const smtpHost = readCfg("smtpHost", "SMTP_HOST");
    const smtpPort = readCfg("SMTP_PORT", "smtpPort");
    const smtpSecure = readCfg("SMTP_SECURE", "smtpSecure");
    const smtpSender = readCfg("SMTP_SENDER", "smtpSender");
    const smtpUser = readCfg("username", "SMTP_USER");
    const smtpPassword = readCfg("password", "SMTP_PASS");

    return (
        <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
            <CardHeader
                title={cfg.configurationName || cfg.configName || "Unnamed Service"}
                subheader={`${serviceTypeDisplay || "Unknown"} - ${cfg.serviceProvider || "Unknown"
                    }`}
                titleTypographyProps={{ variant: "h6", fontWeight: 600 }}
                subheaderTypographyProps={{ variant: "body2", color: "text.secondary" }}
                sx={{ pb: 0 }}
            />

            <Divider sx={{ my: 1 }} />

            <CardContent>
                <Stack direction="row" spacing={1} mb={2}>
                    <Chip label={serviceTypeDisplay || "N/A"} color="primary" size="small" />
                    <Chip label={cfg.serviceProvider || "N/A"} variant="outlined" size="small" />
                </Stack>

                {isEmailService ? (
                    <Stack spacing={1}>
                        <Typography variant="body2">
                            <strong>Host:</strong> {smtpHost || "--"}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Port:</strong> {smtpPort || "--"}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Secure:</strong> {hasValue(smtpSecure) ? String(smtpSecure) : "--"}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Sender:</strong> {smtpSender || "--"}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Username:</strong> {smtpUser || "--"}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Password:</strong> {smtpPassword ? "******" : "--"}
                        </Typography>
                    </Stack>
                ) : (
                    <Stack spacing={1}>
                        <Typography variant="body2">
                            <strong>API Key:</strong> {config.apiKey || "--"}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Model:</strong> {config.model || "--"}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Temperature:</strong> {config.temperature || "--"}
                        </Typography>
                    </Stack>
                )}

                <Box mt={2}>
                    <Stack direction="row" spacing={2}>
                        <Typography variant="caption">
                            <strong>Active:</strong> {cfg.isActive || cfg.active ? "Yes" : "No"}
                        </Typography>
                        <Typography variant="caption">
                            <strong>Default:</strong> {cfg.isDefault || cfg.setDefault ? "Yes" : "No"}
                        </Typography>
                    </Stack>
                </Box>
            </CardContent>

            <Divider />

            <CardActions sx={{ justifyContent: "flex-end" }}>
                <IconButton aria-label="edit" onClick={onEdit}>
                    <EditIcon />
                </IconButton>
                <IconButton aria-label="delete" color="error" onClick={onDelete}>
                    <DeleteIcon />
                </IconButton>
            </CardActions>
        </Card>
    );
}
