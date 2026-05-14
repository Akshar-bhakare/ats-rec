import { Box, Typography, Avatar } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

const MetricBadge = ({
    icon,
    label,
    value,
    trend,
    tone = "primary",
    sx = {},
}) => {
    const theme = useTheme();
    const palette = theme.palette[tone] || theme.palette.primary;

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2.4,
                py: 1.8,
                borderRadius: theme.shape.borderRadius * 1.4,
                backgroundColor: palette?.main
                    ? alpha(palette.main, 0.12)
                    : theme.palette.background.paper,
                border: `1px solid ${alpha(palette?.main || theme.palette.divider, 0.28)}`,
                backdropFilter: "blur(18px)",
                ...sx,
            }}
        >
            <Avatar
                variant="rounded"
                sx={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.shape.borderRadius,
                    background: `linear-gradient(135deg, ${alpha(
                        palette?.light || theme.palette.primary.light,
                        0.9,
                    )}, ${palette?.main || theme.palette.primary.main})`,
                    color: theme.palette.primary.contrastText,
                    fontWeight: 800,
                }}
            >
                {icon}
            </Avatar>
            <Box>
                <Typography variant="overline" sx={{ opacity: 0.7, letterSpacing: 2 }}>
                    {label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {value}
                </Typography>
                {trend && (
                    <Typography variant="caption" sx={{ opacity: 0.72 }}>
                        {trend}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default MetricBadge;
